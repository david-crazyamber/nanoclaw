#!/usr/bin/env npx tsx
/**
 * WeChat (Weixin) QR Code Login Script
 *
 * Uses @tencent-weixin/openclaw-weixin library for all operations.
 */

import {
  startWeixinLoginWithQr,
  waitForWeixinLogin,
  DEFAULT_ILINK_BOT_TYPE,
} from '@tencent-weixin/openclaw-weixin/src/auth/login-qr.js';
import {
  saveWeixinAccount,
  registerWeixinAccountId,
  clearStaleAccountsForUserId,
  DEFAULT_BASE_URL,
} from '@tencent-weixin/openclaw-weixin/src/auth/accounts.js';
import { clearContextTokensForAccount } from '@tencent-weixin/openclaw-weixin/src/messaging/inbound.js';
import qrcodeTerminal from 'qrcode-terminal';

const ACCOUNT_ID = 'default';

async function main(): Promise<void> {
  console.log('\n=== WeChat (Weixin) Login ===\n');
  console.log('Using official library: @tencent-weixin/openclaw-weixin\n');
  console.log('Credentials will be saved to ~/.openclaw/state/openclaw-weixin/\n');

  try {
    console.log('Fetching QR code...\n');

    // Use official library's QR login function
    const startResult = await startWeixinLoginWithQr({
      accountId: ACCOUNT_ID,
      apiBaseUrl: DEFAULT_BASE_URL,
      botType: DEFAULT_ILINK_BOT_TYPE,
      verbose: true,
    });

    if (!startResult.qrcodeUrl) {
      console.error('Failed to get QR code:', startResult.message);
      process.exit(1);
    }

    console.log('Scan this QR code with WeChat:\n');

    // Display QR code in terminal
    qrcodeTerminal.generate(startResult.qrcodeUrl, { small: true });

    console.log('\nOr open this URL in your browser:');
    console.log(startResult.qrcodeUrl);
    console.log('\nWaiting for scan...\n');

    // Wait for login confirmation using official library function
    const loginTimeoutMs = 480_000; // 5 minutes
    console.log('Waiting for login confirmation...\n');

    const waitResult = await waitForWeixinLogin({
      sessionKey: startResult.sessionKey,
      apiBaseUrl: DEFAULT_BASE_URL,
      timeoutMs: loginTimeoutMs,
      verbose: true,
      botType: DEFAULT_ILINK_BOT_TYPE,
    });

    if (!waitResult.connected || !waitResult.botToken || !waitResult.accountId) {
      console.error('\n\nLogin failed:', waitResult.message);
      process.exit(1);
    }

    console.log('\n\nLogin successful!\n');
    console.log(`Bot ID: ${waitResult.accountId}`);
    if (waitResult.userId) {
      console.log(`User ID: ${waitResult.userId}`);
    }

    // Save account data using official library functions
    saveWeixinAccount(ACCOUNT_ID, {
      token: waitResult.botToken,
      baseUrl: waitResult.baseUrl,
      userId: waitResult.userId,
    });

    registerWeixinAccountId(ACCOUNT_ID);

    // Clear stale accounts with same userId
    if (waitResult.userId) {
      clearStaleAccountsForUserId(ACCOUNT_ID, waitResult.userId, clearContextTokensForAccount);
    }

    console.log(`\nAccount saved to: ~/.openclaw/state/openclaw-weixin/accounts/${ACCOUNT_ID}.json`);
    console.log('\nYou can now restart NanoClaw to use WeChat.');
    console.log('Run: launchctl kickstart -k gui/$(id -u)/com.nanoclaw (macOS)');
    console.log('Or: systemctl --user restart nanoclaw (Linux)\n');

  } catch (err) {
    console.error('\nLogin error:', err);
    process.exit(1);
  }
}

main();
