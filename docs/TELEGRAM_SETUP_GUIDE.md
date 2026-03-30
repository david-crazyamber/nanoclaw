# NanoClaw Telegram 适配指南

> 本指南记录了在 NanoClaw 中添加 Telegram 频道支持的完整过程，用于在新计算机上重现设置。

## 概述

本项目为 NanoClaw 添加了完整的 Telegram 频道支持，使用 [grammy](https://grammy.dev) 库实现。主要变更包括：

1. 添加 grammy 依赖
2. 创建 Telegram 频道实现 (`src/channels/telegram.ts`)
3. 添加单元测试 (`src/channels/telegram.test.ts`)
4. 修改类型定义支持 thread_id
5. 添加容器网络主机模式支持（用于 UFW 防火墙环境）

## 前置要求

- Node.js >= 20
- npm 或 pnpm
- Telegram Bot Token（从 [@BotFather](https://t.me/BotFather) 获取）
- SSH Key（用于 Git 推送）

## 设置步骤

### 1. 克隆仓库

```bash
# 使用 SSH 方式克隆
git clone git@github.com:david-crazyamber/nanoclaw.git
cd nanoclaw

# 或者使用 HTTPS 后改为 SSH
git clone https://github.com/david-crazyamber/nanoclaw.git
cd nanoclaw
git remote set-url origin git@github.com:david-crazyamber/nanoclaw.git
```

### 2. 安装依赖

```bash
npm install
```

主要新增依赖：
- `grammy@^1.41.1` - Telegram Bot API 框架
- `silk-wasm@^3.7.1` (dev) - 语音编解码支持

### 3. 配置环境变量

编辑 `.env` 文件，添加 Telegram 配置：

```bash
# Telegram Bot Token（从 @BotFather 获取）
TELEGRAM_BOT_TOKEN=your_bot_token_here

# 可选：启用容器主机网络模式（当 UFW 防火墙阻止 Docker 桥接流量时使用）
CONTAINER_NETWORK_HOST=1
```

### 4. 项目文件变更

#### 4.1 新增文件

**src/channels/telegram.ts** (317 行)
- TelegramChannel 类实现
- 支持文本、图片、视频、语音、文档、贴纸、位置、联系人消息
- 自动转换 @bot_username 提及为触发词格式
- 支持超级群组话题 (message_thread_id)
- 内置 /chatid 和 /ping 命令

**src/channels/telegram.test.ts** (949 行)
- 完整的单元测试覆盖
- 测试连接生命周期、消息处理、@提及转换、媒体消息、消息发送等

#### 4.2 修改文件

**src/channels/index.ts**
```typescript
// 添加
import './telegram.js';
```

**src/types.ts**
```typescript
export interface NewMessage {
  // ... 其他字段
  thread_id?: string;  // 新增：支持 Telegram 话题
}
```

**src/container-runner.ts** (第 257-271 行)
```typescript
// 添加网络主机模式支持
const envVars = readEnvFile(['CONTAINER_NETWORK_HOST']);
const useHostNetwork = envVars.CONTAINER_NETWORK_HOST === '1';
if (useHostNetwork) {
  args.push('--network', 'host');
}
const proxyHost = useHostNetwork ? '127.0.0.1' : CONTAINER_HOST_GATEWAY;
const proxyUrl = `http://${proxyHost}:${CREDENTIAL_PROXY_PORT}`;
```

**package.json**
```json
{
  "dependencies": {
    "grammy": "^1.41.1"
  },
  "devDependencies": {
    "silk-wasm": "^3.7.1"
  }
}
```

### 5. 构建项目

```bash
npm run build
```

### 6. 配置 Telegram Bot

1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新机器人
3. 按提示设置机器人名称和用户名
4. 获取 Bot Token（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）
5. 将 Token 添加到 `.env` 文件的 `TELEGRAM_BOT_TOKEN`

### 7. 获取 Chat ID

启动 NanoClaw 后，在任意聊天中向机器人发送 `/chatid`，机器人会回复该聊天的 ID（格式：`tg:123456789`）。

### 8. 注册群组

在 NanoClaw 的主控制频道中：

```
@Andy register tg:123456789 as my-telegram-group
```

## 功能特性

### 支持的消息类型

| 类型 | 处理方式 |
|------|---------|
| 文本 | 直接传递内容 |
| 图片 | `[Photo] 可选标题` |
| 视频 | `[Video] 可选标题` |
| 语音 | `[Voice message] 可选标题` |
| 音频 | `[Audio] 可选标题` |
| 文档 | `[Document: 文件名] 可选标题` |
| 贴纸 | `[Sticker emoji]` |
| 位置 | `[Location]` |
| 联系人 | `[Contact]` |

### 特殊功能

1. **@提及自动转换**：当用户在消息中 @机器人的用户名时，自动在前面添加触发词（如 `@Andy`），使消息能被正确路由到代理。

2. **话题支持**：在超级群组的话题中发送的消息会保留 `thread_id`，回复会自动发送到正确的话题。

3. **长消息分割**：Telegram 有 4096 字符限制，超长消息会自动分割成多条发送。

4. **Typing 指示器**：当代理正在生成回复时，会显示"正在输入..."状态。

## 测试

运行单元测试：

```bash
npm test -- src/channels/telegram.test.ts
```

测试覆盖：
- 连接生命周期
- 文本消息处理
- @提及转换逻辑
- 媒体消息占位符
- 消息发送（包括超长消息分割）
- 机器人命令 (/chatid, /ping)

## 故障排除

### 容器无法连接到凭证代理

如果启用了 UFW 防火墙，Docker 容器的桥接网络可能被阻止。启用主机网络模式：

```bash
# 在 .env 中添加
CONTAINER_NETWORK_HOST=1
```

### Bot 收不到消息

1. 检查 Bot Token 是否正确
2. 确认已与 Bot 开始对话（在 Telegram 中点击"Start"）
3. 检查群组中 Bot 是否有发送消息权限
4. 查看日志：`tail -f data/nanoclaw.log`

### 消息格式错误

Telegram 使用 Markdown v1 格式：
- `*bold*` - 粗体
- `_italic_` - 斜体
- `` `code` `` - 行内代码
- `` ```code block``` `` - 代码块
- `[text](url)` - 链接

如果 Markdown 解析失败，会自动回退到纯文本模式。

## Git 提交历史

相关提交（从最新到最旧）：

```
43eb462 feat: add Telegram channel support
b7bcebc add pnpm-lock file
bb596fa docs: update CHANGELOG with code formatting changes
f8e1069 style: format WeChat channel and credential proxy code
03dbcca docs: update CHANGELOG with WeChat and CLI commands
b69d407 feat: add WeChat channel support and new CLI commands
```

## 相关文件

- `src/channels/telegram.ts` - 主要实现
- `src/channels/telegram.test.ts` - 单元测试
- `src/channels/index.ts` - 频道注册
- `src/types.ts` - 类型定义
- `src/container-runner.ts` - 容器网络配置
- `package.json` - 依赖

## 参考链接

- [grammy 文档](https://grammy.dev)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [NanoClaw 文档](./REQUIREMENTS.md)
