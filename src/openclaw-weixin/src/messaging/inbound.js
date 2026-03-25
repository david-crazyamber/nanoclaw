"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreContextTokens = restoreContextTokens;
exports.clearContextTokensForAccount = clearContextTokensForAccount;
exports.setContextToken = setContextToken;
exports.getContextToken = getContextToken;
exports.findAccountIdsByContextToken = findAccountIdsByContextToken;
exports.isMediaItem = isMediaItem;
exports.weixinMessageToMsgContext = weixinMessageToMsgContext;
exports.getContextTokenFromMsgContext = getContextTokenFromMsgContext;
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var logger_js_1 = require("../util/logger.js");
var random_js_1 = require("../util/random.js");
var types_js_1 = require("../api/types.js");
var state_dir_js_1 = require("../storage/state-dir.js");
// ---------------------------------------------------------------------------
// Context token store (in-process cache + disk persistence)
// ---------------------------------------------------------------------------
/**
 * contextToken is issued per-message by the Weixin getupdates API and must
 * be echoed verbatim in every outbound send. The in-memory map is the primary
 * lookup; a disk-backed file per account ensures tokens survive gateway restarts.
 */
var contextTokenStore = new Map();
function contextTokenKey(accountId, userId) {
    return "".concat(accountId, ":").concat(userId);
}
// ---------------------------------------------------------------------------
// Disk persistence helpers
// ---------------------------------------------------------------------------
function resolveContextTokenFilePath(accountId) {
    return node_path_1.default.join((0, state_dir_js_1.resolveStateDir)(), "openclaw-weixin", "accounts", "".concat(accountId, ".context-tokens.json"));
}
/** Persist all context tokens for a given account to disk. */
function persistContextTokens(accountId) {
    var prefix = "".concat(accountId, ":");
    var tokens = {};
    for (var _i = 0, contextTokenStore_1 = contextTokenStore; _i < contextTokenStore_1.length; _i++) {
        var _a = contextTokenStore_1[_i], k = _a[0], v = _a[1];
        if (k.startsWith(prefix)) {
            tokens[k.slice(prefix.length)] = v;
        }
    }
    var filePath = resolveContextTokenFilePath(accountId);
    try {
        var dir = node_path_1.default.dirname(filePath);
        node_fs_1.default.mkdirSync(dir, { recursive: true });
        node_fs_1.default.writeFileSync(filePath, JSON.stringify(tokens, null, 0), "utf-8");
    }
    catch (err) {
        logger_js_1.logger.warn("persistContextTokens: failed to write ".concat(filePath, ": ").concat(String(err)));
    }
}
/**
 * Restore persisted context tokens for an account into the in-memory map.
 * Called once during gateway startAccount to survive restarts.
 */
function restoreContextTokens(accountId) {
    var filePath = resolveContextTokenFilePath(accountId);
    try {
        if (!node_fs_1.default.existsSync(filePath))
            return;
        var raw = node_fs_1.default.readFileSync(filePath, "utf-8");
        var tokens = JSON.parse(raw);
        var count = 0;
        for (var _i = 0, _a = Object.entries(tokens); _i < _a.length; _i++) {
            var _b = _a[_i], userId = _b[0], token = _b[1];
            if (typeof token === "string" && token) {
                contextTokenStore.set(contextTokenKey(accountId, userId), token);
                count++;
            }
        }
        logger_js_1.logger.info("restoreContextTokens: restored ".concat(count, " tokens for account=").concat(accountId));
    }
    catch (err) {
        logger_js_1.logger.warn("restoreContextTokens: failed to read ".concat(filePath, ": ").concat(String(err)));
    }
}
/** Remove all context tokens for a given account (memory + disk). */
function clearContextTokensForAccount(accountId) {
    var prefix = "".concat(accountId, ":");
    for (var _i = 0, _a = __spreadArray([], contextTokenStore.keys(), true); _i < _a.length; _i++) {
        var k = _a[_i];
        if (k.startsWith(prefix)) {
            contextTokenStore.delete(k);
        }
    }
    var filePath = resolveContextTokenFilePath(accountId);
    try {
        if (node_fs_1.default.existsSync(filePath))
            node_fs_1.default.unlinkSync(filePath);
    }
    catch (err) {
        logger_js_1.logger.warn("clearContextTokensForAccount: failed to remove ".concat(filePath, ": ").concat(String(err)));
    }
    logger_js_1.logger.info("clearContextTokensForAccount: cleared tokens for account=".concat(accountId));
}
/** Store a context token for a given account+user pair (memory + disk). */
function setContextToken(accountId, userId, token) {
    var k = contextTokenKey(accountId, userId);
    logger_js_1.logger.debug("setContextToken: key=".concat(k));
    contextTokenStore.set(k, token);
    persistContextTokens(accountId);
}
/** Retrieve the cached context token for a given account+user pair. */
function getContextToken(accountId, userId) {
    var k = contextTokenKey(accountId, userId);
    var val = contextTokenStore.get(k);
    logger_js_1.logger.debug("getContextToken: key=".concat(k, " found=").concat(val !== undefined, " storeSize=").concat(contextTokenStore.size));
    return val;
}
/**
 * Find all accountIds that have an active contextToken for the given userId.
 * Used to infer the sending bot account from the recipient address when
 * accountId is not explicitly provided (e.g. cron delivery).
 *
 * Returns all matching accountIds (not just the first) so the caller can
 * detect ambiguity when multiple accounts have sessions with the same user.
 */
function findAccountIdsByContextToken(accountIds, userId) {
    return accountIds.filter(function (id) { return contextTokenStore.has(contextTokenKey(id, userId)); });
}
// ---------------------------------------------------------------------------
// Message ID generation
// ---------------------------------------------------------------------------
function generateMessageSid() {
    return (0, random_js_1.generateId)("openclaw-weixin");
}
/** Returns true if the message item is a media type (image, video, file, or voice). */
function isMediaItem(item) {
    return (item.type === types_js_1.MessageItemType.IMAGE ||
        item.type === types_js_1.MessageItemType.VIDEO ||
        item.type === types_js_1.MessageItemType.FILE ||
        item.type === types_js_1.MessageItemType.VOICE);
}
function bodyFromItemList(itemList) {
    var _a, _b;
    if (!(itemList === null || itemList === void 0 ? void 0 : itemList.length))
        return "";
    for (var _i = 0, itemList_1 = itemList; _i < itemList_1.length; _i++) {
        var item = itemList_1[_i];
        if (item.type === types_js_1.MessageItemType.TEXT && ((_a = item.text_item) === null || _a === void 0 ? void 0 : _a.text) != null) {
            var text = String(item.text_item.text);
            var ref = item.ref_msg;
            if (!ref)
                return text;
            // Quoted media is passed as MediaPath; only include the current text as body.
            if (ref.message_item && isMediaItem(ref.message_item))
                return text;
            // Build quoted context from both title and message_item content.
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
            return "[\u5F15\u7528: ".concat(parts.join(" | "), "]\n").concat(text);
        }
        // 语音转文字：如果语音消息有 text 字段，直接使用文字内容
        if (item.type === types_js_1.MessageItemType.VOICE && ((_b = item.voice_item) === null || _b === void 0 ? void 0 : _b.text)) {
            return item.voice_item.text;
        }
    }
    return "";
}
/**
 * Convert a WeixinMessage from getUpdates to the inbound MsgContext for the core pipeline.
 * Media: only pass MediaPath (local file, after CDN download + decrypt).
 * We never pass MediaUrl — the upstream CDN URL is encrypted/auth-only.
 * Priority when multiple media types present: image > video > file > voice.
 */
function weixinMessageToMsgContext(msg, accountId, opts) {
    var _a, _b, _c;
    var from_user_id = (_a = msg.from_user_id) !== null && _a !== void 0 ? _a : "";
    var ctx = {
        Body: bodyFromItemList(msg.item_list),
        From: from_user_id,
        To: from_user_id,
        AccountId: accountId,
        OriginatingChannel: "openclaw-weixin",
        OriginatingTo: from_user_id,
        MessageSid: generateMessageSid(),
        Timestamp: msg.create_time_ms,
        Provider: "openclaw-weixin",
        ChatType: "direct",
    };
    if (msg.context_token) {
        ctx.context_token = msg.context_token;
    }
    if (opts === null || opts === void 0 ? void 0 : opts.decryptedPicPath) {
        ctx.MediaPath = opts.decryptedPicPath;
        ctx.MediaType = "image/*";
    }
    else if (opts === null || opts === void 0 ? void 0 : opts.decryptedVideoPath) {
        ctx.MediaPath = opts.decryptedVideoPath;
        ctx.MediaType = "video/mp4";
    }
    else if (opts === null || opts === void 0 ? void 0 : opts.decryptedFilePath) {
        ctx.MediaPath = opts.decryptedFilePath;
        ctx.MediaType = (_b = opts.fileMediaType) !== null && _b !== void 0 ? _b : "application/octet-stream";
    }
    else if (opts === null || opts === void 0 ? void 0 : opts.decryptedVoicePath) {
        ctx.MediaPath = opts.decryptedVoicePath;
        ctx.MediaType = (_c = opts.voiceMediaType) !== null && _c !== void 0 ? _c : "audio/wav";
    }
    return ctx;
}
/** Extract the context_token from an inbound WeixinMsgContext. */
function getContextTokenFromMsgContext(ctx) {
    return ctx.context_token;
}
