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

describe('WeixinChannel', () => {
  let channel: WeixinChannel;
  const mockOnMessage = vi.fn();
  const mockOnChatMetadata = vi.fn();
  const registeredGroups: Record<string, RegisteredGroup> = {};

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  describe('disconnect', () => {
    it('should set running to false', async () => {
      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
    });
  });
});
