// Channel self-registration barrel file.
// Each import triggers the channel module's registerChannel() call.

// discord

// gmail

// slack

// telegram
import './telegram.js';

// whatsapp

// weixin
import { WeixinChannel } from './weixin.js';
import { registerChannel } from './registry.js';
registerChannel('weixin', (opts) => new WeixinChannel(opts));
