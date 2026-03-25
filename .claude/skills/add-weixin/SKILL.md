---
name: add-weixin
description: Add WeChat (Weixin) as a channel. Can replace WhatsApp/Telegram entirely or run alongside them. Uses QR code login for authentication.
---

# Add WeChat (Weixin) Channel

This skill adds WeChat (微信) support to NanoClaw using the skills engine for deterministic code changes, then walks through interactive setup.

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `weixin` is in `applied_skills`, skip to Phase 3 (Setup). The code changes are already in place.

### Ask the user

Use `AskUserQuestion` to collect configuration:

AskUserQuestion: Should WeChat replace other channels or run alongside them?
- **Replace all** - WeChat will be the only channel (sets WEIXIN_ONLY=true)
- **Alongside** - WeChat, WhatsApp, and Telegram channels can all be active

## Phase 2: Apply Code Changes

Run the skills engine to apply this skill's code package.

### Initialize skills system (if needed)

If `.nanoclaw/` directory doesn't exist yet:

```bash
npx tsx scripts/apply-skill.ts --init
```

Or call `initSkillsSystem()` from `skills-engine/migrate.ts`.

### Apply the skill

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-weixin
```

This deterministically:
- Adds `src/channels/weixin.ts` (WeixinChannel class implementing Channel interface)
- Adds `src/channels/weixin.test.ts` (unit tests)
- Three-way merges WeChat support into `src/index.ts` (multi-channel support)
- Three-way merges WeChat config into `src/config.ts` (WEIXIN_ONLY export)
- Records the application in `.nanoclaw/state.yaml`

If the apply reports merge conflicts, read the intent files:
- `modify/src/index.ts.intent.md` — what changed and invariants for index.ts
- `modify/src/config.ts.intent.md` — what changed for config.ts

### Validate code changes

```bash
npm test
npm run build
```

All tests must pass (including the new weixin tests) and build must be clean before proceeding.

## Phase 3: Setup

### QR Code Login

WeChat authentication uses QR code login. The user needs to:

1. Run the login helper script (will be provided after code changes)
2. Scan the displayed QR code with WeChat app
3. Confirm the login on their phone
4. The credentials will be saved automatically

Tell the user:

> **WeChat Login Setup**
>
> 1. Make sure you have the WeChat app installed on your phone
> 2. Run: `npx tsx scripts/weixin-login.ts`
> 3. A QR code will be displayed in the terminal
> 4. Open WeChat on your phone and scan the QR code
> 5. Confirm the login on your phone
> 6. Wait for the "Login successful" message

Wait for the user to complete the login.

### Configure environment

Add to `.env` (if WEIXIN_ONLY was selected):

```bash
WEIXIN_ONLY=true
```

Sync to container environment:

```bash
mkdir -p data/env && cp .env data/env/env
```

The container reads environment from `data/env/env`, not `.env` directly.

### Build and restart

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
# Linux: systemctl --user restart nanoclaw
```

## Phase 4: Registration

### Get Chat Info

For WeChat, the chat ID is the user's WeChat ID (format: `xxx@im.wechat`). When a message is received, the system will log the sender's ID.

Tell the user:

> **Registering WeChat Chats**
>
> 1. Send a message to your bot from the WeChat account you want to register
> 2. Check the logs: `tail -f logs/nanoclaw.log`
> 3. Look for a log line showing the sender ID (format: `wx:xxx@im.wechat`)
> 4. Note this ID for registration

### Register the chat

Use the IPC register flow or register directly. The chat ID, name, and folder name are needed.

For a main chat (responds to all messages, uses the `main` folder):

```typescript
registerGroup("wx:xxx@im.wechat", {
  name: "<chat-name>",
  folder: "main",
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: false,
});
```

For additional chats (trigger-only):

```typescript
registerGroup("wx:xxx@im.wechat", {
  name: "<chat-name>",
  folder: "<folder-name>",
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: true,
});
```

## Phase 5: Verify

### Test the connection

Tell the user:

> Send a message to your registered WeChat chat:
> - For main chat: Any message works
> - For non-main: `@Andy hello` or include the trigger
>
> The bot should respond within a few seconds.

### Check logs if needed

```bash
tail -f logs/nanoclaw.log
```

## Troubleshooting

### Bot not responding

Check:
1. QR login completed successfully (account file exists in `store/weixin/accounts/`)
2. Chat is registered in SQLite (check with: `sqlite3 store/messages.db "SELECT * FROM registered_groups WHERE jid LIKE 'wx:%'"`)
3. For non-main chats: message includes trigger pattern
4. Service is running: `launchctl list | grep nanoclaw` (macOS) or `systemctl --user status nanoclaw` (Linux)

### Session expired

If you see "session expired" errors in the logs:
1. The WeChat session may have expired
2. Re-run the login script: `npx tsx scripts/weixin-login.ts`
3. Scan the QR code again

### Getting chat ID

If you're not seeing messages in the logs:
- Verify the service is running and connected
- Check that the account file exists: `ls store/weixin/accounts/`
- Look for incoming message logs: `grep "inbound message" logs/nanoclaw.log`

## After Setup

If running `npm run dev` while the service is active:

```bash
# macOS:
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
npm run dev
# When done testing:
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
# Linux:
# systemctl --user stop nanoclaw
# npm run dev
# systemctl --user start nanoclaw
```

## Removal

To remove WeChat integration:

1. Delete `src/channels/weixin.ts`
2. Remove `WeixinChannel` import and creation from `src/index.ts`
3. Remove `channels` array references if reverting to single channel
4. Remove WeChat config (`WEIXIN_ONLY`) from `src/config.ts`
5. Remove WeChat registrations from SQLite: `sqlite3 store/messages.db "DELETE FROM registered_groups WHERE jid LIKE 'wx:%'"`
6. Remove account files: `rm -rf store/weixin/`
7. Rebuild: `npm run build && launchctl kickstart -k gui/$(id -u)/com.nanoclaw` (macOS) or `npm run build && systemctl --user restart nanoclaw` (Linux)
