"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeixinChannel = exports.MessageState = exports.MessageType = exports.MessageItemType = void 0;
var api_js_1 = require("../openclaw-weixin/src/api/api.js");
var types_js_1 = require("../openclaw-weixin/src/api/types.js");
Object.defineProperty(exports, "MessageItemType", { enumerable: true, get: function () { return types_js_1.MessageItemType; } });
Object.defineProperty(exports, "MessageType", { enumerable: true, get: function () { return types_js_1.MessageType; } });
Object.defineProperty(exports, "MessageState", { enumerable: true, get: function () { return types_js_1.MessageState; } });
var accounts_js_1 = require("../openclaw-weixin/src/auth/accounts.js");
var inbound_js_1 = require("../openclaw-weixin/src/messaging/inbound.js");
var sync_buf_js_1 = require("../openclaw-weixin/src/storage/sync-buf.js");
var logger_js_1 = require("../logger.js");
/** Extract body text from message items */
function bodyFromItemList(itemList) {
    var _a, _b;
    if (!(itemList === null || itemList === void 0 ? void 0 : itemList.length))
        return '';
    for (var _i = 0, itemList_1 = itemList; _i < itemList_1.length; _i++) {
        var item = itemList_1[_i];
        if (item.type === types_js_1.MessageItemType.TEXT && ((_a = item.text_item) === null || _a === void 0 ? void 0 : _a.text) != null) {
            var text = String(item.text_item.text);
            var ref = item.ref_msg;
            if (!ref)
                return text;
            // Quoted media
            if (ref.message_item && isMediaItem(ref.message_item))
                return text;
            // Build quoted context
            var parts = [];
            if (ref.title)
                parts.push(ref.title);
            if (ref.message_item) {
                var refBody = bodyFromItemList([ref.message_item]);
                if (refBody)
                    parts.push(refBody);
            }
            if (!parts.length)
                return text;
            return "[\u5F15\u7528\uFF1A".concat(parts.join(' | '), "]\n").concat(text);
        }
        // Voice to text
        if (item.type === types_js_1.MessageItemType.VOICE && ((_b = item.voice_item) === null || _b === void 0 ? void 0 : _b.text)) {
            return item.voice_item.text;
        }
    }
    return '';
}
/** Check if message item is a media type */
function isMediaItem(item) {
    return (item.type === types_js_1.MessageItemType.IMAGE ||
        item.type === types_js_1.MessageItemType.VIDEO ||
        item.type === types_js_1.MessageItemType.FILE ||
        item.type === types_js_1.MessageItemType.VOICE);
}
/** Get placeholder text for media items */
function getMediaPlaceholder(item) {
    switch (item.type) {
        case types_js_1.MessageItemType.IMAGE:
            return '[图片]';
        case types_js_1.MessageItemType.VIDEO:
            return '[视频]';
        case types_js_1.MessageItemType.FILE:
            return '[文件]';
        case types_js_1.MessageItemType.VOICE:
            return '[语音]';
        default:
            return '[媒体]';
    }
}
var WeixinChannel = /** @class */ (function () {
    function WeixinChannel(opts) {
        this.name = 'weixin';
        this.accountData = null;
        this.running = false;
        this.abortController = null;
        this.pollTimeoutMs = 35000;
        this.opts = opts;
        // Get the first available account or use a default
        var accountIds = (0, accounts_js_1.listIndexedWeixinAccountIds)();
        if (accountIds.length > 0) {
            this.accountId = accountIds[0];
        }
        else {
            this.accountId = 'default';
        }
    }
    WeixinChannel.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                // Load account credentials using official library function
                this.accountData = (0, accounts_js_1.loadWeixinAccount)(this.accountId);
                if (!((_a = this.accountData) === null || _a === void 0 ? void 0 : _a.token)) {
                    logger_js_1.logger.warn({ accountId: this.accountId }, 'WeChat not configured: run QR login first');
                    console.log('\n  WeChat: Not configured');
                    console.log('  Run: npx tsx scripts/weixin-login.ts\n');
                    return [2 /*return*/];
                }
                // Restore context tokens from disk using official library function
                (0, inbound_js_1.restoreContextTokens)(this.accountId);
                this.running = true;
                this.abortController = new AbortController();
                // Start the long-poll loop in the background
                this.startPollLoop();
                logger_js_1.logger.info({ accountId: this.accountId }, 'WeChat channel connected');
                console.log("\n  WeChat: Connected (".concat(this.accountId, ")\n"));
                return [2 /*return*/];
            });
        });
    };
    WeixinChannel.prototype.startPollLoop = function () {
        return __awaiter(this, void 0, void 0, function () {
            var syncFilePath, getUpdatesBuf, baseUrl, token, consecutiveFailures, MAX_CONSECUTIVE_FAILURES, BACKOFF_DELAY_MS, RETRY_DELAY_MS, resp, msgs, _i, msgs_1, msg, err_1;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        syncFilePath = (0, sync_buf_js_1.getSyncBufFilePath)(this.accountId);
                        getUpdatesBuf = (_a = (0, sync_buf_js_1.loadGetUpdatesBuf)(syncFilePath)) !== null && _a !== void 0 ? _a : '';
                        baseUrl = ((_b = this.accountData) === null || _b === void 0 ? void 0 : _b.baseUrl) || accounts_js_1.DEFAULT_BASE_URL;
                        token = (_c = this.accountData) === null || _c === void 0 ? void 0 : _c.token;
                        if (!token) {
                            logger_js_1.logger.error({ accountId: this.accountId }, 'No token available');
                            return [2 /*return*/];
                        }
                        consecutiveFailures = 0;
                        MAX_CONSECUTIVE_FAILURES = 3;
                        BACKOFF_DELAY_MS = 30000;
                        RETRY_DELAY_MS = 2000;
                        _f.label = 1;
                    case 1:
                        if (!(this.running && !((_d = this.abortController) === null || _d === void 0 ? void 0 : _d.signal.aborted))) return [3 /*break*/, 19];
                        _f.label = 2;
                    case 2:
                        _f.trys.push([2, 13, , 18]);
                        return [4 /*yield*/, (0, api_js_1.getUpdates)({
                                baseUrl: baseUrl,
                                token: token,
                                get_updates_buf: getUpdatesBuf,
                                timeoutMs: this.pollTimeoutMs,
                            })];
                    case 3:
                        resp = _f.sent();
                        // Update poll timeout if server suggests
                        if (resp.longpolling_timeout_ms && resp.longpolling_timeout_ms > 0) {
                            this.pollTimeoutMs = resp.longpolling_timeout_ms;
                        }
                        if (!(resp.ret !== 0 && resp.ret !== undefined)) return [3 /*break*/, 8];
                        logger_js_1.logger.warn({ ret: resp.ret, errcode: resp.errcode, errmsg: resp.errmsg }, 'WeChat getUpdates error');
                        consecutiveFailures++;
                        if (!(consecutiveFailures >= MAX_CONSECUTIVE_FAILURES)) return [3 /*break*/, 5];
                        logger_js_1.logger.error({ consecutiveFailures: consecutiveFailures }, 'WeChat: Max consecutive failures, backing off');
                        return [4 /*yield*/, this.sleep(BACKOFF_DELAY_MS)];
                    case 4:
                        _f.sent();
                        consecutiveFailures = 0;
                        return [3 /*break*/, 7];
                    case 5: return [4 /*yield*/, this.sleep(RETRY_DELAY_MS)];
                    case 6:
                        _f.sent();
                        _f.label = 7;
                    case 7: return [3 /*break*/, 1];
                    case 8:
                        consecutiveFailures = 0;
                        // Save sync buffer using official library function
                        if (resp.get_updates_buf && resp.get_updates_buf !== '') {
                            (0, sync_buf_js_1.saveGetUpdatesBuf)(syncFilePath, resp.get_updates_buf);
                            getUpdatesBuf = resp.get_updates_buf;
                        }
                        msgs = resp.msgs || [];
                        _i = 0, msgs_1 = msgs;
                        _f.label = 9;
                    case 9:
                        if (!(_i < msgs_1.length)) return [3 /*break*/, 12];
                        msg = msgs_1[_i];
                        return [4 /*yield*/, this.processMessage(msg)];
                    case 10:
                        _f.sent();
                        _f.label = 11;
                    case 11:
                        _i++;
                        return [3 /*break*/, 9];
                    case 12: return [3 /*break*/, 18];
                    case 13:
                        err_1 = _f.sent();
                        if ((_e = this.abortController) === null || _e === void 0 ? void 0 : _e.signal.aborted) {
                            logger_js_1.logger.info('WeChat poll loop stopped');
                            return [2 /*return*/];
                        }
                        logger_js_1.logger.error({ err: err_1 }, 'WeChat poll loop error');
                        consecutiveFailures++;
                        if (!(consecutiveFailures >= MAX_CONSECUTIVE_FAILURES)) return [3 /*break*/, 15];
                        return [4 /*yield*/, this.sleep(BACKOFF_DELAY_MS)];
                    case 14:
                        _f.sent();
                        consecutiveFailures = 0;
                        return [3 /*break*/, 17];
                    case 15: return [4 /*yield*/, this.sleep(RETRY_DELAY_MS)];
                    case 16:
                        _f.sent();
                        _f.label = 17;
                    case 17: return [3 /*break*/, 18];
                    case 18: return [3 /*break*/, 1];
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    WeixinChannel.prototype.processMessage = function (msg) {
        return __awaiter(this, void 0, void 0, function () {
            var fromUserId, chatJid, timestamp, content, mediaItems, _i, mediaItems_1, item, placeholder, senderName, group;
            var _a, _b;
            return __generator(this, function (_c) {
                fromUserId = msg.from_user_id || '';
                chatJid = "wx:".concat(fromUserId);
                timestamp = msg.create_time_ms
                    ? new Date(msg.create_time_ms).toISOString()
                    : new Date().toISOString();
                // Store context token using official library function (memory + disk)
                if (msg.context_token) {
                    (0, inbound_js_1.setContextToken)(this.accountId, fromUserId, msg.context_token);
                }
                content = bodyFromItemList(msg.item_list);
                mediaItems = ((_a = msg.item_list) === null || _a === void 0 ? void 0 : _a.filter(function (item) { return isMediaItem(item); })) ||
                    [];
                for (_i = 0, mediaItems_1 = mediaItems; _i < mediaItems_1.length; _i++) {
                    item = mediaItems_1[_i];
                    placeholder = getMediaPlaceholder(item);
                    if (content) {
                        content += "\n".concat(placeholder);
                    }
                    else {
                        content = placeholder;
                    }
                }
                if (!content.trim()) {
                    logger_js_1.logger.debug({ fromUserId: fromUserId }, 'Skipping empty WeChat message');
                    return [2 /*return*/];
                }
                senderName = fromUserId.split('@')[0] || 'Unknown';
                // Store chat metadata for discovery
                this.opts.onChatMetadata(chatJid, timestamp, senderName, 'weixin', false);
                group = this.opts.registeredGroups()[chatJid];
                if (!group) {
                    logger_js_1.logger.debug({ chatJid: chatJid, senderName: senderName }, 'Message from unregistered WeChat chat');
                    return [2 /*return*/];
                }
                // Deliver message
                this.opts.onMessage(chatJid, {
                    id: ((_b = msg.message_id) === null || _b === void 0 ? void 0 : _b.toString()) || msg.client_id || String(Date.now()),
                    chat_jid: chatJid,
                    sender: fromUserId,
                    sender_name: senderName,
                    content: content,
                    timestamp: timestamp,
                    is_from_me: false,
                });
                logger_js_1.logger.info({ chatJid: chatJid, senderName: senderName, contentPreview: content.slice(0, 50) }, 'WeChat message stored');
                return [2 /*return*/];
            });
        });
    };
    WeixinChannel.prototype.sleep = function (ms) {
        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
    };
    WeixinChannel.prototype.sendMessage = function (jid, text) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, contextToken, baseUrl, token, itemList, msg, err_2;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        logger_js_1.logger.info({
                            jid: jid,
                            textLength: text.length,
                            textPreview: text.slice(0, 100),
                            hasToken: !!((_a = this.accountData) === null || _a === void 0 ? void 0 : _a.token),
                            hasBaseUrl: !!((_b = this.accountData) === null || _b === void 0 ? void 0 : _b.baseUrl),
                        }, 'WeChat sendMessage called');
                        if (!((_c = this.accountData) === null || _c === void 0 ? void 0 : _c.token)) {
                            logger_js_1.logger.warn({ jid: jid, accountId: this.accountId }, 'WeChat not configured, cannot send message');
                            return [2 /*return*/];
                        }
                        userId = jid.replace(/^wx:/, '');
                        contextToken = (0, inbound_js_1.getContextToken)(this.accountId, userId);
                        logger_js_1.logger.info({
                            jid: jid,
                            userId: userId,
                            accountId: this.accountId,
                            contextTokenExists: !!contextToken,
                            contextTokenLength: contextToken ? contextToken.length : 0,
                        }, 'WeChat sendMessage context token check');
                        if (!contextToken) {
                            logger_js_1.logger.warn({ jid: jid, userId: userId, accountId: this.accountId }, 'No context token for WeChat message, cannot reply');
                            return [2 /*return*/];
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        baseUrl = this.accountData.baseUrl || accounts_js_1.DEFAULT_BASE_URL;
                        token = this.accountData.token;
                        itemList = text
                            ? [{ type: types_js_1.MessageItemType.TEXT, text_item: { text: text } }]
                            : [];
                        msg = {
                            from_user_id: '',
                            to_user_id: userId,
                            client_id: undefined,
                            message_type: types_js_1.MessageType.BOT,
                            message_state: types_js_1.MessageState.FINISH,
                            item_list: itemList.length ? itemList : undefined,
                            context_token: contextToken,
                        };
                        logger_js_1.logger.info({
                            baseUrl: baseUrl,
                            endpoint: 'ilink/bot/sendmessage',
                            toUserId: userId,
                            messageLength: text.length,
                        }, 'WeChat sendMessage calling API');
                        // Use official library's sendMessage function
                        return [4 /*yield*/, (0, api_js_1.sendMessage)({
                                baseUrl: baseUrl,
                                token: token,
                                body: { msg: msg },
                            })];
                    case 2:
                        // Use official library's sendMessage function
                        _d.sent();
                        logger_js_1.logger.info({
                            jid: jid,
                            length: text.length,
                            contextTokenUsed: contextToken ? "".concat(contextToken.slice(0, 10), "...") : undefined,
                        }, 'WeChat message sent');
                        return [3 /*break*/, 4];
                    case 3:
                        err_2 = _d.sent();
                        logger_js_1.logger.error({
                            jid: jid,
                            err: err_2 instanceof Error ? err_2.message : String(err_2),
                            textPreview: text.slice(0, 100),
                        }, 'Failed to send WeChat message');
                        throw err_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    WeixinChannel.prototype.isConnected = function () {
        var _a;
        return this.running && !!((_a = this.accountData) === null || _a === void 0 ? void 0 : _a.token);
    };
    WeixinChannel.prototype.ownsJid = function (jid) {
        return jid.startsWith('wx:');
    };
    WeixinChannel.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.running = false;
                if (this.abortController) {
                    this.abortController.abort();
                    this.abortController = null;
                }
                logger_js_1.logger.info('WeChat channel disconnected');
                return [2 /*return*/];
            });
        });
    };
    WeixinChannel.prototype.setTyping = function (jid, isTyping) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Not implemented
                logger_js_1.logger.debug({ jid: jid, isTyping: isTyping }, 'WeChat typing indicator not implemented');
                return [2 /*return*/];
            });
        });
    };
    return WeixinChannel;
}());
exports.WeixinChannel = WeixinChannel;
