# Changelog

All notable changes to NanoClaw will be documented in this file.

## [Unreleased]

### Added
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

## [1.2.0](https://github.com/qwibitai/nanoclaw/compare/v1.1.6...v1.2.0)

[BREAKING] WhatsApp removed from core, now a skill. Run `/add-whatsapp` to re-add (existing auth/groups preserved).
- **fix:** Prevent scheduled tasks from executing twice when container runtime exceeds poll interval (#138, #669)