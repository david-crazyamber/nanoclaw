import fs from 'fs';
import path from 'path';
import {
  getUpdates,
  sendMessage,
  type WeixinApiOptions,
} from '@tencent-weixin/openclaw-weixin/dist/api/api.js';
import {
  type WeixinMessage,
  MessageItemType,
} from '@tencent-weixin/openclaw-weixin/dist/api/types.js';
import {
  loadWeixinAccount,
  saveWeixinAccount,
  listIndexedWeixinAccountIds,
  type WeixinAccountData,
} from '@tencent-weixin/openclaw-weixin/dist/auth/accounts.js';
import { ASSISTANT_NAME } from '../config.js';
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

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';
const DEFAULT_CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c';
const STORE_DIR = path.join(process.cwd(), 'store');
const WEIXIN_STORE_DIR = path.join(STORE_DIR, 'weixin');
const ACCOUNTS_DIR = path.join(WEIXIN_STORE_DIR, 'accounts');
const SYNC_BUF_DIR = path.join(WEIXIN_STORE_DIR, 'sync');

/** Ensure storage directories exist */
function ensureStorageDirs(): void {
  fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
  fs.mkdirSync(SYNC_BUF_DIR, { recursive: true });
}

/** Get sync buffer file path for an account */
function getSyncBufFilePath(accountId: string): string {
  return path.join(SYNC_BUF_DIR, `${accountId}.buf`);
}

/** Load sync buffer from file */
function loadGetUpdatesBuf(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // ignore
  }
  return null;
}

/** Save sync buffer to file */
function saveGetUpdatesBuf(filePath: string, buf: string): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buf, 'utf-8');
  } catch (err) {
    logger.warn({ err, filePath }, 'Failed to save sync buffer');
  }
}

/** Extract body text from message items */
function bodyFromItemList(itemList?: WeixinMessage['item_list']): string {
  if (!itemList?.length) return '';
  for (const item of itemList) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text != null) {
      const text = String(item.text_item.text);
      const ref = item.ref_msg;
      if (!ref) return text;
      // Quoted media is passed as placeholder; only include the current text as body
      if (ref.message_item && isMediaItem(ref.message_item)) return text;
      // Build quoted context
      const parts: string[] = [];
      if (ref.title) parts.push(ref.title);
      if (ref.message_item) {
        const refBody = bodyFromItemList([ref.message_item]);
        if (refBody) parts.push(refBody);
      }
      if (!parts.length) return text;
      return `[引用: ${parts.join(' | ')}]\n${text}`;
    }
    // Voice to text
    if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
      return `[语音] ${item.voice_item.text}`;
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

/** Context token store for replies */
const contextTokenStore = new Map<string, string>();

function contextTokenKey(accountId: string, userId: string): string {
  return `${accountId}:${userId}`;
}

function setContextToken(accountId: string, userId: string, token: string): void {
  contextTokenStore.set(contextTokenKey(accountId, userId), token);
}

function getContextToken(accountId: string, userId: string): string | undefined {
  return contextTokenStore.get(contextTokenKey(accountId, userId));
}

export class WeixinChannel implements Channel {
  name = 'weixin';

  private opts: WeixinChannelOpts;
  private accountId: string;
  private accountData: WeixinAccountData | null = null;
  private running = false;
  private abortController: AbortController | null = null;
  private pollTimeoutMs = 35000;

  constructor(opts: WeixinChannelOpts) {
    this.opts = opts;
    ensureStorageDirs();

    // Get the first available account or use a default
    const accountIds = listIndexedWeixinAccountIds();
    if (accountIds.length > 0) {
      this.accountId = accountIds[0];
    } else {
      // Default account ID - will need login
      this.accountId = 'default';
    }
  }

  async connect(): Promise<void> {
    // Load account credentials
    this.accountData = loadWeixinAccount(this.accountId);

    if (!this.accountData?.token) {
      logger.warn(
        { accountId: this.accountId },
        'WeChat not configured: run QR login first',
      );
      console.log('\n  WeChat: Not configured');
      console.log(
        '  Run: npx tsx scripts/weixin-login.ts\n',
      );
      return;
    }

    this.running = true;
    this.abortController = new AbortController();

    // Start the long-poll loop in the background
    this.startPollLoop();

    logger.info(
      { accountId: this.accountId },
      'WeChat channel connected',
    );
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

        // Save sync buffer
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
    const fromUserId = msg.from_user_id || '';
    const toUserId = msg.to_user_id || '';
    const chatJid = `wx:${fromUserId}`;
    const timestamp = msg.create_time_ms
      ? new Date(msg.create_time_ms).toISOString()
      : new Date().toISOString();

    // Store context token for replies
    if (msg.context_token) {
      setContextToken(this.accountId, fromUserId, msg.context_token);
    }

    // Build message content
    let content = bodyFromItemList(msg.item_list);

    // Add media placeholders for non-text items
    const mediaItems = msg.item_list?.filter((item) => isMediaItem(item)) || [];
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

    // Extract sender name (WeChat doesn't provide names in the API, use ID)
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
    if (!this.accountData?.token) {
      logger.warn('WeChat not configured, cannot send message');
      return;
    }

    const userId = jid.replace(/^wx:/, '');
    const contextToken = getContextToken(this.accountId, userId);

    if (!contextToken) {
      logger.warn(
        { jid, userId },
        'No context token for WeChat message, cannot reply',
      );
      return;
    }

    try {
      const baseUrl = this.accountData.baseUrl || DEFAULT_BASE_URL;
      const token = this.accountData.token;

      // Build message request
      const itemList = text
        ? [{ type: MessageItemType.TEXT, text_item: { text } }]
        : [];

      await sendMessage({
        baseUrl,
        token,
        body: {
          msg: {
            from_user_id: '',
            to_user_id: userId,
            message_type: 2, // BOT
            message_state: 2, // FINISH
            item_list: itemList.length ? itemList : undefined,
            context_token: contextToken,
          },
        },
      });

      logger.info({ jid, length: text.length }, 'WeChat message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send WeChat message');
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
    // WeChat typing indicator is not supported in the basic API
    // Would require getConfig + sendTyping with typing_ticket
    // Skipping for simplicity
    logger.debug({ jid, isTyping }, 'WeChat typing indicator not implemented');
  }
}
