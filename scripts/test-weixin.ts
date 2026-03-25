#!/usr/bin/env npx tsx
/**
 * 微信 (Weixin) 收发消息测试程序
 *
 * 用于测试微信通道的消息接收和发送功能
 * 可诊断以下问题:
 * - 消息接收 (长轮询)
 * - Context token 存储
 * - 消息发送 (回复功能)
 *
 * 使用方法:
 *   npx tsx scripts/test-weixin.ts              # 运行交互式测试
 *   npx tsx scripts/test-weixin.ts --diagnostic # 显示诊断信息
 *   npx tsx scripts/test-weixin.ts --help       # 显示帮助
 */

import fs from 'fs';
import path from 'path';
import { WeixinChannel } from '../src/channels/weixin.js';
import { logger } from '../src/logger.js';

const ACCOUNT_ID = 'default';
const ACCOUNTS_DIR = path.join(process.cwd(), 'store', 'weixin', 'accounts');

interface WeixinAccount {
  token?: string;
  savedAt?: string;
  baseUrl?: string;
  userId?: string;
}

/** 加载账户数据 */
function loadAccount(accountId: string): WeixinAccount | null {
  const filePath = path.join(ACCOUNTS_DIR, `${accountId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as WeixinAccount;
  } catch {
    return null;
  }
}

/** 格式化字节数为可读格式 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 打印帮助信息 */
function printHelp(): void {
  console.log(`
微信消息测试程序
===============

使用方法:
  npx tsx scripts/test-weixin.ts [选项]

选项:
  --diagnostic, -d    显示诊断信息 (不运行测试)
  --help, -h          显示此帮助信息

程序功能:
  1. 检查微信账户配置
  2. 连接微信并监听消息
  3. 自动回复收到的消息
  4. 记录所有 API 请求和响应

使用场景:
  - 测试微信连接状态
  - 调试消息收发问题
  - 验证 context token 处理
  - 检查 API 端点响应

相关文件:
  账户文件：store/weixin/accounts/default.json
  同步缓存：store/weixin/sync/default.buf
  日志输出：查看控制台输出

相关脚本:
  npx tsx scripts/weixin-login.ts    # QR 码登录
`);
}

/** 打印诊断信息 */
function printDiagnostics(accountData: WeixinAccount): void {
  console.log('\n=== 诊断信息 ===\n');

  console.log('账户配置:');
  console.log(`  账户 ID: ${ACCOUNT_ID}`);
  console.log(`  API 地址：${accountData.baseUrl || '(默认)'}`);
  console.log(`  用户 ID: ${accountData.userId || '(未设置)'}`);
  console.log(`  Token: ${accountData.token ? `${accountData.token.slice(0, 10)}... (${formatBytes(accountData.token.length)})` : '缺失'}`);
  console.log(`  保存时间：${accountData.savedAt || '(未知)'}`);

  console.log('\n微信 API 端点:');
  const baseUrl = accountData.baseUrl || 'https://ilinkai.weixin.qq.com';
  console.log(`  获取消息：${baseUrl}/ilink/bot/getupdates`);
  console.log(`  发送消息：${baseUrl}/ilink/bot/sendmessage`);

  console.log('\n存储位置:');
  console.log(`  账户文件：${path.join(ACCOUNTS_DIR, `${ACCOUNT_ID}.json`)}`);
  console.log(`  同步缓存：${path.join(process.cwd(), 'store', 'weixin', 'sync', `${ACCOUNT_ID}.buf`)}`);

  console.log('\nContext Token 说明:');
  console.log('  - Context token 在收到消息时存储在内存 (Map) 中');
  console.log('  - 键格式：{accountId}:{userId}');
  console.log('  - 回复消息时必须要有 token');
  console.log('  - Token 可能过期或在进程重启后失效');

  console.log('\n常见问题:');
  console.log('  1. 无 context token: 先发送一条消息来生成 token');
  console.log('  2. Token 过期：可能需要重新登录');
  console.log('  3. to_user_id 为空：检查账户文件中的 userId');
  console.log('  4. API 错误：检查网络和 token 是否有效');
  console.log('');
}

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('   微信消息测试程序');
  console.log('========================================\n');

  // 检查帮助标志
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  // 检查诊断模式标志
  if (process.argv.includes('--diagnostic') || process.argv.includes('-d')) {
    const accountData = loadAccount(ACCOUNT_ID);
    if (!accountData) {
      console.error('错误：未找到账户配置，请先运行 QR 码登录。\n');
      process.exit(1);
    }
    printDiagnostics(accountData);
    return;
  }

  // 步骤 1: 检查账户配置
  console.log('1. 检查账户配置...\n');

  const accountData = loadAccount(ACCOUNT_ID);

  if (!accountData) {
    console.error(`   错误：未找到账户 "${ACCOUNT_ID}"`);
    console.error(`   文件位置：${path.join(ACCOUNTS_DIR, `${ACCOUNT_ID}.json`)}`);
    console.error('\n   请先运行 QR 码登录:');
    console.error('   npx tsx scripts/weixin-login.ts\n');
    process.exit(1);
  }

  console.log(`   账户 ID: ${ACCOUNT_ID}`);
  console.log(`   API 地址：${accountData.baseUrl || '(默认)'}`);
  console.log(`   用户 ID: ${accountData.userId || '(未设置)'}`);
  console.log(`   Token: ${accountData.token ? `${accountData.token.slice(0, 10)}... (${formatBytes(accountData.token.length)})` : '缺失'}`);
  console.log(`   保存时间：${accountData.savedAt || '(未知)'}`);

  if (!accountData.token) {
    console.error('\n   错误：Token 缺失!');
    console.error('   请运行 QR 码登录：npx tsx scripts/weixin-login.ts\n');
    process.exit(1);
  }

  console.log('\n   账户配置正常\n');

  // 步骤 2: 创建通道实例
  console.log('2. 创建微信通道...\n');

  const receivedMessages: Array<{ chatJid: string; content: string; timestamp: string }> = [];
  const registeredChats: Record<string, { name: string; folder: string; trigger: string; added_at: string; channels: string[] }> = {};

  const channel = new WeixinChannel({
    onMessage: (chatJid, msg) => {
      console.log('\n----------------------------------------');
      console.log('   收到消息');
      console.log('----------------------------------------');
      console.log(`   Chat JID: ${chatJid}`);
      console.log(`   发送者：${msg.sender_name} (${msg.sender})`);
      console.log(`   时间：${new Date(msg.timestamp).toLocaleString()}`);
      console.log(`   内容：${msg.content}`);
      console.log('----------------------------------------\n');

      receivedMessages.push({ chatJid, content: msg.content, timestamp: msg.timestamp });

      // 自动回复测试
      console.log('   开始自动回复测试...\n');
      console.log('   说明：WeixinChannel 在收到消息时会自动存储 context_token');
      console.log('   sendMessage 方法会自动使用这个 token 进行回复\n');

      const replyText = `[测试回复] 收到你的消息：${msg.content.slice(0, 50)}${msg.content.length > 50 ? '...' : ''}`;

      channel.sendMessage(chatJid, replyText)
        .then(() => {
          console.log(`   ✓ 回复发送成功!\n`);
        })
        .catch((err) => {
          console.error(`   ✗ 回复发送失败：${err instanceof Error ? err.message : String(err)}\n`);
          console.error('   可能原因:');
          console.error('   1. Context token 已过期或丢失');
          console.error('   2. 网络/API 错误');
          console.error('   3. to_user_id 或 from_user_id 无效\n');
        });
    },
    onChatMetadata: (chatJid, _timestamp, senderName, channelName) => {
      // 自动注册发送消息的聊天
      if (!registeredChats[chatJid]) {
        registeredChats[chatJid] = {
          name: senderName || 'Unknown',
          folder: 'test',
          trigger: '*',
          added_at: new Date().toISOString(),
          channels: ['weixin'],
        };
        console.log(`   [自动注册聊天：${chatJid} (${senderName || '未知'})]\n`);
      }
      logger.debug({ chatJid, senderName, channelName }, 'Chat metadata received');
    },
    registeredGroups: () => registeredChats,
  });

  // 步骤 3: 连接到微信
  console.log('3. 连接到微信...\n');

  await channel.connect();

  if (!channel.isConnected()) {
    console.error('\n   错误：微信连接失败');
    console.error('   通道在 connect() 调用后未连接\n');
    process.exit(1);
  }

  console.log('   已连接!\n');

  // 步骤 4: 开始监听消息
  console.log('========================================');
  console.log('   正在监听微信消息...');
  console.log('========================================\n');
  console.log('使用说明:');
  console.log('1. 从微信给机器人发送一条测试消息');
  console.log('2. 观察上方控制台输出');
  console.log('3. 脚本会自动回复消息');
  console.log('4. 检查微信是否收到回复');
  console.log('\n按 Ctrl+C 退出\n');

  // 处理退出
  process.on('SIGINT', () => {
    console.log('\n\n正在退出...\n');
    channel.disconnect()
      .then(() => {
        console.log('=== 测试摘要 ===\n');
        console.log(`收到消息数：${receivedMessages.length}`);
        if (receivedMessages.length > 0) {
          console.log('\n收到的消息:');
          receivedMessages.forEach((m, i) => {
            console.log(`  ${i + 1}. ${m.chatJid}: ${m.content.slice(0, 50)}...`);
          });
        }
        console.log('\n诊断信息:');
        console.log('  运行 --diagnostic 查看详细系统信息');
        console.log('  示例：npx tsx scripts/test-weixin.ts --diagnostic\n');
        console.log('完成。\n');
        process.exit(0);
      })
      .catch((err) => {
        console.error('断开连接错误:', err);
        process.exit(1);
      });
  });

  // 保持进程运行
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('\n致命错误:', err);
  process.exit(1);
});
