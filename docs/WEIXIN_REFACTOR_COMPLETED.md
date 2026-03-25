# 微信通道重构完成报告

## 重构概述

已成功将 `src/channels/weixin.ts` 和 `scripts/weixin-login.ts` 重构为使用官方库 `@tencent-weixin/openclaw-weixin` 的存储格式和 API 调用模式。

## 主要改动

### 1. 存储路径变更

**之前：**
```
./store/weixin/
├── accounts/
│   └── {accountId}.json
└── sync/
    └── {accountId}.buf
```

**现在（与官方库兼容）：**
```
~/.openclaw/state/openclaw-weixin/
├── accounts.json              # 账号 ID 列表
├── accounts/
│   ├── {accountId}.json       # 账号凭证（token, baseUrl, userId）
│   ├── {accountId}.sync.json  # getUpdates 游标
│   └── {accountId}.context-tokens.json  # Context Token 持久化
```

### 2. Context Token 持久化

**问题诊断：** 之前的实现只将 `context_token` 存储在内存 Map 中，进程重启后丢失，导致无法回复消息。

**解决方案：**
- 添加磁盘持久化：收到消息时将 `context_token` 保存到 `accounts/{accountId}.context-tokens.json`
- 启动时恢复：`connect()` 时调用 `restoreContextTokens()` 从文件恢复
- 每次收到新消息时同步更新磁盘文件

**代码实现：**
```typescript
// 收到消息时存储（内存 + 磁盘）
if (msg.context_token) {
  setContextToken(this.accountId, fromUserId, msg.context_token);
}

// 启动时恢复
restoreContextTokens(this.accountId);
```

### 3. API 调用封装

采用官方库的实现模式：

```typescript
// buildBaseInfo - 每个请求的 base_info  payload
function buildBaseInfo(): { channel_version: string } {
  return { channel_version: '1.0.0' };
}

// randomWechatUin - X-WECHAT-UIN header 生成
function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), 'utf-8').toString('base64');
}
```

### 4. 账号管理

- 使用 `accounts.json` 索引文件记录所有登录的账号 ID
- 支持多账号（虽然当前默认使用 `default` 账号）
- 账号文件权限设置为 `0o600`（仅所有者可读写）

## 文件清单

| 文件 | 改动说明 |
|------|----------|
| `src/channels/weixin.ts` | 完全重写，使用官方存储路径和 Context Token 持久化 |
| `scripts/weixin-login.ts` | 更新为官方存储格式，登录时注册账号 ID |

## 测试状态

- 编译：`npm run build` ✓
- 单元测试：`npm test -- src/channels/weixin.test.ts` ✓ (5 个测试全部通过)

## 迁移说明

### 旧数据迁移

如果之前有已登录的微信账号，需要重新运行登录脚本：

```bash
npx tsx scripts/weixin-login.ts
```

_credentials 会自动保存到新的位置。_

### 验证步骤

1. 运行登录脚本获取 QR 码
2. 使用微信扫码并确认
3. 检查凭证文件是否生成：
   ```bash
   cat ~/.openclaw/state/openclaw-weixin/accounts/default.json
   ```
4. 重启 NanoClaw：
   ```bash
   launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
   # 或
   systemctl --user restart nanoclaw  # Linux
   ```
5. 测试收发消息功能

## 与官方库的兼容性

| 功能 | 官方库实现 | 当前实现 | 状态 |
|------|-----------|---------|------|
| 存储路径 | `~/.openclaw/state/openclaw-weixin/` | 同官方 | ✓ |
| 账号索引 | `accounts.json` | 同官方 | ✓ |
| 账号凭证 | `accounts/{id}.json` | 同官方 | ✓ |
| Sync 游标 | `accounts/{id}.sync.json` | 同官方 | ✓ |
| Context Token | `accounts/{id}.context-tokens.json` | 同官方 | ✓ |
| API 调用 | `buildBaseInfo`, `randomWechatUin` | 同官方 | ✓ |
| 长轮询 | 35 秒超时，错误退避 | 同官方 | ✓ |
| 消息发送 | 包含 `context_token` | 同官方 | ✓ |

## 下一步

重构已完成，核心功能（接收消息、发送消息、Context Token 持久化）已实现。

如果需要更完整的功能（如媒体文件上传下载、语音转文字等），可以直接使用官方库 `@tencent-weixin/openclaw-weixin` 作为 NanoClaw 的通道插件。
