# config.ts Intent

## What Changed

Added WeChat (Weixin) configuration support:

1. Added `WEIXIN_ONLY` to the `readEnvFile` call so it's loaded from `.env`
2. Added `WEIXIN_ONLY` export (boolean flag, defaults to false)

## Invariants

- All config values are read via `readEnvFile()` to avoid loading secrets into process.env
- Boolean flags use `=== 'true'` pattern for consistent parsing
- No other behavior changes
- Existing Telegram config remains unchanged
- WEIXIN_ONLY follows the same pattern as TELEGRAM_ONLY
