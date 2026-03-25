import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeixinChannel } from './weixin.js';
import type { RegisteredGroup } from '../types.js';

// Mock the logger
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the weixin library
vi.mock('@tencent-weixin/openclaw-weixin/dist/api/api.js', () => ({
  getUpdates: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('@tencent-weixin/openclaw-weixin/dist/auth/accounts.js', () => ({
  loadWeixinAccount: vi.fn(),
  saveWeixinAccount: vi.fn(),
  listIndexedWeixinAccountIds: vi.fn(),
}));

describe('WeixinChannel', () => {
  let channel: WeixinChannel;
  const mockOnMessage = vi.fn();
  const mockOnChatMetadata = vi.fn();
  const registeredGroups: Record<string, RegisteredGroup> = {};

  beforeEach(async () => {
    vi.clearAllMocks();
    const { listIndexedWeixinAccountIds } = await import(
      '@tencent-weixin/openclaw-weixin/dist/auth/accounts.js'
    );
    vi.mocked(listIndexedWeixinAccountIds).mockReturnValue([]);

    channel = new WeixinChannel({
      onMessage: mockOnMessage,
      onChatMetadata: mockOnChatMetadata,
      registeredGroups: () => registeredGroups,
    });
  });

  afterEach(async () => {
    await channel.disconnect();
  });

  describe('name', () => {
    it('should return "weixin"', () => {
      expect(channel.name).toBe('weixin');
    });
  });

  describe('ownsJid', () => {
    it('should return true for wx: prefixed JIDs', () => {
      expect(channel.ownsJid('wx:xxx@im.wechat')).toBe(true);
      expect(channel.ownsJid('wx:user123')).toBe(true);
    });

    it('should return false for non-wx JIDs', () => {
      expect(channel.ownsJid('tg:123456')).toBe(false);
      expect(channel.ownsJid('123456@g.us')).toBe(false);
      expect(channel.ownsJid('123456@s.whatsapp.net')).toBe(false);
    });
  });

  describe('isConnected', () => {
    it('should return false before connect', () => {
      expect(channel.isConnected()).toBe(false);
    });

    it('should return false when no token is available', async () => {
      const { loadWeixinAccount } = await import(
        '@tencent-weixin/openclaw-weixin/dist/auth/accounts.js'
      );
      vi.mocked(loadWeixinAccount).mockReturnValue(null);

      await channel.connect();
      expect(channel.isConnected()).toBe(false);
    });

    it('should return true when connected with token', async () => {
      const { loadWeixinAccount } = await import(
        '@tencent-weixin/openclaw-weixin/dist/auth/accounts.js'
      );
      vi.mocked(loadWeixinAccount).mockReturnValue({
        token: 'test-token',
        savedAt: new Date().toISOString(),
      });

      await channel.connect();
      expect(channel.isConnected()).toBe(true);
      await channel.disconnect();
    });
  });

  describe('sendMessage', () => {
    it('should not send if not configured', async () => {
      const { loadWeixinAccount } = await import(
        '@tencent-weixin/openclaw-weixin/dist/auth/accounts.js'
      );
      const { sendMessage } = await import(
        '@tencent-weixin/openclaw-weixin/dist/api/api.js'
      );
      vi.mocked(loadWeixinAccount).mockReturnValue(null);

      await channel.sendMessage('wx:user@im.wechat', 'Hello');
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should not send without context token', async () => {
      const { loadWeixinAccount } = await import(
        '@tencent-weixin/openclaw-weixin/dist/auth/accounts.js'
      );
      const { sendMessage } = await import(
        '@tencent-weixin/openclaw-weixin/dist/api/api.js'
      );
      vi.mocked(loadWeixinAccount).mockReturnValue({
        token: 'test-token',
        savedAt: new Date().toISOString(),
      });

      // Need to connect first to get internal state set up
      await channel.connect();

      // No message received yet, so no context token
      await channel.sendMessage('wx:user@im.wechat', 'Hello');
      expect(sendMessage).not.toHaveBeenCalled();
      await channel.disconnect();
    });
  });

  describe('disconnect', () => {
    it('should set running to false', async () => {
      const { loadWeixinAccount } = await import(
        '@tencent-weixin/openclaw-weixin/dist/auth/accounts.js'
      );
      vi.mocked(loadWeixinAccount).mockReturnValue({
        token: 'test-token',
        savedAt: new Date().toISOString(),
      });

      await channel.connect();
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
    });
  });
});
