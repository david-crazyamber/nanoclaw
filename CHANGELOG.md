# Changelog

All notable changes to NanoClaw will be documented in this file.

## [1.2.0](https://github.com/qwibitai/nanoclaw/compare/v1.1.6...v1.2.0)

[BREAKING] WhatsApp removed from core, now a skill. Run `/add-whatsapp` to re-add (existing auth/groups preserved).
- **fix:** Prevent scheduled tasks from executing twice when container runtime exceeds poll interval (#138, #669)


Login successful!

Bot ID: 49dd72c1be35@im.bot
User ID: o9cq80zdmY0jVDx2hbODDYzM1mvI@im.wechat

Account saved to: ~/.openclaw/state/openclaw-weixin/accounts/default.json

You can now restart NanoClaw to use WeChat.
Run: launchctl kickstart -k gui/$(id -u)/com.nanoclaw (macOS)
Or: systemctl --user restart nanoclaw (Linux)