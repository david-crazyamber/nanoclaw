# 微信通道重构计划

## 问题背景

当前的 `src/channels/weixin.ts` 实现是错误的——它是基于对微信 API 的理解"瞎搞"的，而不是使用官方提供的 `@tencent-weixin/openclaw-weixin` 库。

用户反馈：**能收到微信消息，但无法回复消息**。

## 正确的方案

应该使用官方库 `@tencent-weixin/openclaw-weixin`（版本 2.0.1），该库已经完整实现了：

1. **扫码登录授权** - QR 码和配对码两种方式
2. **长轮询接收消息** - `getUpdates` 接口
3. **发送消息** - `sendMessage` 接口，正确处理 `context_token`
4. **CDN 媒体上传下载** - 图片/视频/文件
5. **Context Token 管理** - 会话上下文令牌的存储和恢复
6. **多账号支持** - 多个微信号同时在线

## 官方库架构

### 核心文件

| 文件 | 功能 |
|------|------|
| `index.ts` | 插件入口，导出 `weixinPlugin` |
| `src/channel.ts` | 插件注册 |
| `src/auth/accounts.ts` | 账号管理（加载/保存/列出） |
| `src/auth/login-qr.ts` | QR 码登录流程 |
| `src/monitor/monitor.ts` | 长轮询监听循环 |
| `src/messaging/inbound.ts` | 消息接收和 context_token 存储 |
| `src/messaging/send.ts` | 消息发送 |
| `src/messaging/send-media.ts` | 媒体文件发送 |
| `src/api/api.ts` | API 调用封装 |
| `src/storage/sync-buf.ts` | 同步游标持久化 |
| `src/storage/state-dir.ts` | 状态目录管理 |

### 账号存储路径

```
~/.openclaw/state/openclaw-weixin/
├── accounts.json              # 账号 ID 列表
├── accounts/
│   └── {accountId}.json       # 每个账号的凭证（token, baseUrl, userId）
└── sync-buf/
    └── {accountId}.buf        # getUpdates 游标
```

### Context Token 管理

官方库在 `src/messaging/inbound.ts` 中处理：

```typescript
// 收到消息时存储 context_token
const key = `${accountId}:${fromUserId}`;
contextTokenMap.set(key, contextToken);

// 发送回复时读取
const contextToken = contextTokenMap.get(`${accountId}:${toUserId}`);
```

**关键点**：
- Context_token 存储在内存 Map 中
- 同时也持久化到 `accounts/{accountId}.context-tokens.json`
- 进程重启后会从文件恢复

## 重构方案

### 选项 A：完全使用官方库（推荐）

如果 NanoClaw 是基于 OpenClaw 构建的，应该：

1. 将微信通道完全替换为 `@tencent-weixin/openclaw-weixin` 插件
2. 删除 `src/channels/weixin.ts`
3. 使用 `openclaw channels login --channel openclaw-weixin` 进行扫码登录
4. 使用官方 CLI 管理微信账号

### 选项 B：复用官方库的核心逻辑

如果 NanoClaw 是独立系统，需要复用官方库的实现：

1. **账号管理** - 复制 `src/auth/accounts.ts` 的存储逻辑
2. **消息接收** - 复制 `src/monitor/monitor.ts` 的长轮询逻辑
3. **消息发送** - 复制 `src/messaging/send.ts` 的发送逻辑
4. **Context Token** - 复制 `src/messaging/inbound.ts` 的 token 管理

### 当前问题诊断

查看现有实现 `src/channels/weixin.ts`：

1. **存储路径错误** - 使用 `store/weixin/` 而不是 `~/.openclaw/state/openclaw-weixin/`
2. **Context Token 持久化缺失** - 只存储在内存 Map 中，重启后丢失
3. **账号格式不兼容** - 官方使用 `normalizeAccountId` 处理 ID 格式

## 验证步骤

1. 检查当前 NanoClaw 是否使用 OpenClaw 框架
2. 如果是，直接启用官方插件
3. 如果不是，复用官方库的核心模块

## 测试程序修改

`scripts/test-weixin.ts` 也需要相应修改：

1. 使用官方库的 API 进行测试
2. 或者直接使用官方 CLI：`openclaw-weixin test`

## 关键代码引用

### 官方发送消息实现

```typescript
// src/messaging/send.ts
export async function sendMessageWeixin(params: {
  to: string;
  text: string;
  opts: WeixinApiOptions & { contextToken?: string };
}): Promise<{ messageId: string }> {
  const clientId = generateClientId();
  const req = {
    msg: {
      from_user_id: "",
      to_user_id: to,
      client_id: clientId,
      message_type: MessageType.BOT,
      message_state: MessageState.FINISH,
      item_list: [{ type: MessageItemType.TEXT, text_item: { text } }],
      context_token: opts.contextToken ?? undefined,
    },
  };
  await sendMessageApi({ baseUrl, token, body: req });
  return { messageId: clientId };
}
```

### 官方 Context Token 恢复

```typescript
// src/messaging/inbound.ts
export function restoreContextTokens(accountId: string): void {
  const filePath = getContextTokensPath(accountId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const stored = JSON.parse(raw) as Record<string, string>;
      for (const [key, token] of Object.entries(stored)) {
        contextTokenMap.set(key, token);
      }
    }
  } catch { /* ignore */ }
}
```

## 下一步行动

1. 确认 NanoClaw 与 OpenClaw 的关系
2. 决定采用选项 A 还是选项 B
3. 执行重构
4. 测试收发消息功能
