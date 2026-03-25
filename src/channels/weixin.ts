import {
  getUpdates,
  sendMessage,
  buildBaseInfo,
} from '../openclaw-weixin/src/api/api.js';
import type {
  WeixinMessage,
  MessageItem,
  GetUpdatesResp,
} from '../openclaw-weixin/src/api/types.js';
import {
  MessageItemType,
  MessageType,
  MessageState,
} from '../openclaw-weixin/src/api/types.js';
import {
  loadWeixinAccount,
  listIndexedWeixinAccountIds,
  DEFAULT_BASE_URL,
} from '../openclaw-weixin/src/auth/accounts.js';
import {
  setContextToken,
  getContextToken,
  restoreContextTokens,
} from '../openclaw-weixin/src/messaging/inbound.js';
import { generateId } from '../openclaw-weixin/src/util/random.js';
import {
  getSyncBufFilePath,
  loadGetUpdatesBuf,
  saveGetUpdatesBuf,
} from '../openclaw-weixin/src/storage/sync-buf.js';
import { logger } from '../logger.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

export interface WeixinChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

// Re-export types for compatibility with existing code
export type { WeixinMessage, MessageItem, GetUpdatesResp };
export { MessageItemType, MessageType, MessageState };

/** Extract body text from message items */
function bodyFromItemList(itemList?: MessageItem[]): string {
  if (!itemList?.length) return '';
  for (const item of itemList) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text != null) {
      const text = String(item.text_item.text);
      const ref = item.ref_msg;
      if (!ref) return text;
      // Quoted media
      if (ref.message_item && isMediaItem(ref.message_item)) return text;
      // Build quoted context
      const parts: string[] = [];
      if (ref.title) parts.push(ref.title);
      if (ref.message_item) {
        const refBody = bodyFromItemList([ref.message_item]);
        if (refBody) parts.push(refBody);
      }
      if (!parts.length) return text;
      return `[引用：${parts.join(' | ')}]\n${text}`;
    }
    // Voice to text
    if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }
  return '';
}

/** Check if message item is a media type */
function isMediaItem(item: { type?: number }): boolean {
  return (
    item.type === MessageItemType.IMAGE ||
    item.type === MessageItemType.VIDEO ||
    item.type === MessageItemType.FILE ||
    item.type === MessageItemType.VOICE
  );
}

/** Get placeholder text for media items */
function getMediaPlaceholder(item: { type?: number }): string {
  switch (item.type) {
    case MessageItemType.IMAGE:
      return '[图片]';
    case MessageItemType.VIDEO:
      return '[视频]';
    case MessageItemType.FILE:
      return '[文件]';
    case MessageItemType.VOICE:
      return '[语音]';
    default:
      return '[媒体]';
  }
}

export class WeixinChannel implements Channel {
  name = 'weixin';

  private opts: WeixinChannelOpts;
  private accountId: string;
  private accountData: ReturnType<typeof loadWeixinAccount> = null;
  private running = false;
  private abortController: AbortController | null = null;
  private pollTimeoutMs = 35000;

  constructor(opts: WeixinChannelOpts) {
    this.opts = opts;

    // Get the first available account or use a default
    const accountIds = listIndexedWeixinAccountIds();
    if (accountIds.length > 0) {
      this.accountId = accountIds[0];
    } else {
      this.accountId = 'default';
    }
  }

  async connect(): Promise<void> {
    // Load account credentials using official library function
    this.accountData = loadWeixinAccount(this.accountId);

    if (!this.accountData?.token) {
      logger.warn(
        { accountId: this.accountId },
        'WeChat not configured: run QR login first',
      );
      console.log('\n  WeChat: Not configured');
      console.log('  Run: npx tsx scripts/weixin-login.ts\n');
      return;
    }

    // Restore context tokens from disk using official library function
    restoreContextTokens(this.accountId);

    this.running = true;
    this.abortController = new AbortController();

    // Start the long-poll loop in the background
    this.startPollLoop();

    logger.info({ accountId: this.accountId }, 'WeChat channel connected');
    console.log(`\n  WeChat: Connected (${this.accountId})\n`);
  }

  private async startPollLoop(): Promise<void> {
    const syncFilePath = getSyncBufFilePath(this.accountId);
    let getUpdatesBuf = loadGetUpdatesBuf(syncFilePath) ?? '';

    const baseUrl = this.accountData?.baseUrl || DEFAULT_BASE_URL;
    const token = this.accountData?.token;

    if (!token) {
      logger.error({ accountId: this.accountId }, 'No token available');
      return;
    }

    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const BACKOFF_DELAY_MS = 30000;
    const RETRY_DELAY_MS = 2000;

    while (this.running && !this.abortController?.signal.aborted) {
      try {
        // Use official library's getUpdates function
        const resp = await getUpdates({
          baseUrl,
          token,
          get_updates_buf: getUpdatesBuf,
          timeoutMs: this.pollTimeoutMs,
        });

        // Update poll timeout if server suggests
        if (resp.longpolling_timeout_ms && resp.longpolling_timeout_ms > 0) {
          this.pollTimeoutMs = resp.longpolling_timeout_ms;
        }

        // Check for API errors
        if (resp.ret !== 0 && resp.ret !== undefined) {
          logger.warn(
            { ret: resp.ret, errcode: resp.errcode, errmsg: resp.errmsg },
            'WeChat getUpdates error',
          );
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            logger.error(
              { consecutiveFailures },
              'WeChat: Max consecutive failures, backing off',
            );
            await this.sleep(BACKOFF_DELAY_MS);
            consecutiveFailures = 0;
          } else {
            await this.sleep(RETRY_DELAY_MS);
          }
          continue;
        }

        consecutiveFailures = 0;

        // Save sync buffer using official library function
        if (resp.get_updates_buf && resp.get_updates_buf !== '') {
          saveGetUpdatesBuf(syncFilePath, resp.get_updates_buf);
          getUpdatesBuf = resp.get_updates_buf;
        }

        // Process messages
        const msgs = resp.msgs || [];
        for (const msg of msgs) {
          await this.processMessage(msg);
        }
      } catch (err) {
        if (this.abortController?.signal.aborted) {
          logger.info('WeChat poll loop stopped');
          return;
        }
        logger.error({ err }, 'WeChat poll loop error');
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          await this.sleep(BACKOFF_DELAY_MS);
          consecutiveFailures = 0;
        } else {
          await this.sleep(RETRY_DELAY_MS);
        }
      }
    }
  }

  private async processMessage(msg: WeixinMessage): Promise<void> {
    logger.info(msg, 'WeChat message recieved');

    const fromUserId = msg.from_user_id || '';
    const chatJid = `wx:${fromUserId}`;
    const timestamp = msg.create_time_ms
      ? new Date(msg.create_time_ms).toISOString()
      : new Date().toISOString();

    // Store context token using official library function (memory + disk)
    if (msg.context_token) {
      setContextToken(this.accountId, fromUserId, msg.context_token);
    }

    // Build message content
    let content = bodyFromItemList(msg.item_list);

    // Add media placeholders for non-text items
    const mediaItems =
      msg.item_list?.filter((item: { type?: number }) => isMediaItem(item)) ||
      [];
    for (const item of mediaItems) {
      const placeholder = getMediaPlaceholder(item);
      if (content) {
        content += `\n${placeholder}`;
      } else {
        content = placeholder;
      }
    }

    if (!content.trim()) {
      logger.debug({ fromUserId }, 'Skipping empty WeChat message');
      return;
    }

    // Extract sender name
    const senderName = fromUserId.split('@')[0] || 'Unknown';

    // Store chat metadata for discovery
    this.opts.onChatMetadata(chatJid, timestamp, senderName, 'weixin', false);

    // Only deliver full message for registered groups
    const group = this.opts.registeredGroups()[chatJid];
    if (!group) {
      logger.debug(
        { chatJid, senderName },
        'Message from unregistered WeChat chat',
      );
      return;
    }

    // Deliver message
    this.opts.onMessage(chatJid, {
      id: msg.message_id?.toString() || msg.client_id || String(Date.now()),
      chat_jid: chatJid,
      sender: fromUserId,
      sender_name: senderName,
      content,
      timestamp,
      is_from_me: false,
    });

    logger.info(
      { chatJid, senderName, contentPreview: content.slice(0, 50) },
      'WeChat message stored',
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    logger.info(
      {
        jid,
        textLength: text.length,
        textPreview: text.slice(0, 100),
        hasToken: !!this.accountData?.token,
        hasBaseUrl: !!this.accountData?.baseUrl,
      },
      'WeChat sendMessage called',
    );

    if (!this.accountData?.token) {
      logger.warn(
        { jid, accountId: this.accountId },
        'WeChat not configured, cannot send message',
      );
      return;
    }

    const userId = jid.replace(/^wx:/, '');

    // Get context token using official library function
    const contextToken = getContextToken(this.accountId, userId);

    logger.info(
      {
        jid,
        userId,
        accountId: this.accountId,
        contextTokenExists: !!contextToken,
        contextTokenLength: contextToken ? contextToken.length : 0,
      },
      'WeChat sendMessage context token check',
    );

    if (!contextToken) {
      logger.warn(
        { jid, userId, accountId: this.accountId },
        'No context token for WeChat message, cannot reply',
      );
      return;
    }

    try {
      const baseUrl = this.accountData.baseUrl || DEFAULT_BASE_URL;
      const token = this.accountData.token;

      // Build message using official types
      const itemList = text
        ? [{ type: MessageItemType.TEXT, text_item: { text } }]
        : [];

      const msg = {
        from_user_id: '',
        to_user_id: userId,
        client_id: generateId('nanoclaw'),
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        item_list: itemList.length ? itemList : undefined,
        context_token: contextToken,
      };

      logger.info(msg, 'Message Object');

      logger.info(
        {
          baseUrl,
          endpoint: 'ilink/bot/sendmessage',
          toUserId: userId,
          messageLength: text.length,
        },
        'WeChat sendMessage calling API',
      );

      // Use official library's sendMessage function
      await sendMessage({
        baseUrl,
        token,
        body: { msg },
      });

      logger.info(
        {
          jid,
          length: text.length,
          contextTokenUsed: contextToken
            ? `${contextToken.slice(0, 10)}...`
            : undefined,
        },
        'WeChat message sent',
      );
    } catch (err) {
      logger.error(
        {
          jid,
          err: err instanceof Error ? err.message : String(err),
          textPreview: text.slice(0, 100),
        },
        'Failed to send WeChat message',
      );
      throw err;
    }
  }

  isConnected(): boolean {
    return this.running && !!this.accountData?.token;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('wx:');
  }

  async disconnect(): Promise<void> {
    this.running = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    logger.info('WeChat channel disconnected');
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    // Not implemented
    logger.debug({ jid, isTyping }, 'WeChat typing indicator not implemented');
  }
}
