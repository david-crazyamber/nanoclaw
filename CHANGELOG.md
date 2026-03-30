# Changelog

All notable changes to NanoClaw will be documented in this file.

## [Unreleased]

### Added
- **Telegram channel support** - New messaging channel using grammy library
  - Complete Telegram bot integration with message handling
  - Support for text, photo, video, voice, documents, stickers, location, contact
  - Thread/topic support for supergroups
  - `/chatid` and `/ping` bot commands
  - Auto-convert @bot mentions to trigger pattern
  - Container network host mode option for UFW compatibility
  - Full unit test coverage (949 lines of tests)
- **WeChat (Weixin) channel support** - New messaging channel with QR code login
  - WeChat channel implementation with long-polling message reception
  - `/add-weixin` skill for easy installation
  - `scripts/weixin-login.ts` for QR code authentication
  - `scripts/test-weixin.ts` for testing message sending
  - Integration with openclaw-weixin library
- **New slash commands**
  - `/changes` - Show comprehensive change summary before shipping
  - `/deploy` - Deployment pipeline (bump version, rebuild container, restart service)
  - `/ship` - Commit and push with optional branch merging
- **Documentation** - AI call chain diagnostics, Weixin refactor plans
- **pnpm support** - Added pnpm-lock.yaml for pnpm package manager

### Changed
- Enhanced credential proxy with improved test coverage
- Container runner updates for multi-channel support
- Container Dockerfile improvements
- Code formatting improvements: standardized quote style, trailing commas, line breaks across WeChat channel and credential proxy

## [1.2.0](https://github.com/qwibitai/nanoclaw/compare/v1.1.6...v1.2.0)

[BREAKING] WhatsApp removed from core, now a skill. Run `/add-whatsapp` to re-add (existing auth/groups preserved).
- **fix:** Prevent scheduled tasks from executing twice when container runtime exceeds poll interval (#138, #669)