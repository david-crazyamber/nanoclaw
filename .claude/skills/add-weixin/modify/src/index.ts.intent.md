# index.ts Intent

## What Changed

Added WeChat (Weixin) channel support:

1. Added `WEIXIN_ONLY` import from config
2. Added `WeixinChannel` import from `./channels/weixin.js`
3. Added WeixinChannel creation after Telegram, before WhatsApp check
4. Updated WhatsApp condition to also check `WEIXIN_ONLY`: `if (!TELEGRAM_ONLY && !WEIXIN_ONLY)`

## Invariants

- WeixinChannel is always created (it checks for credentials internally)
- WhatsApp is only created if neither TELEGRAM_ONLY nor WEIXIN_ONLY is set
- Telegram is created if TELEGRAM_BOT_TOKEN is present (unchanged)
- All channel callbacks remain the same (shared `channelOpts`)
- `findChannel` routing automatically works via `ownsJid` method
- No changes to message processing logic (processGroupMessages, runAgent, etc.)
- No changes to shutdown handling
- Existing multi-channel architecture is preserved
