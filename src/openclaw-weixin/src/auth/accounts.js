"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.CDN_BASE_URL = exports.DEFAULT_BASE_URL = void 0;
exports.deriveRawAccountId = deriveRawAccountId;
exports.listIndexedWeixinAccountIds = listIndexedWeixinAccountIds;
exports.registerWeixinAccountId = registerWeixinAccountId;
exports.unregisterWeixinAccountId = unregisterWeixinAccountId;
exports.clearStaleAccountsForUserId = clearStaleAccountsForUserId;
exports.loadWeixinAccount = loadWeixinAccount;
exports.saveWeixinAccount = saveWeixinAccount;
exports.clearWeixinAccount = clearWeixinAccount;
exports.loadConfigRouteTag = loadConfigRouteTag;
exports.triggerWeixinChannelReload = triggerWeixinChannelReload;
exports.listWeixinAccountIds = listWeixinAccountIds;
exports.resolveWeixinAccount = resolveWeixinAccount;
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var account_id_1 = require("openclaw/plugin-sdk/account-id");
var state_dir_js_1 = require("../storage/state-dir.js");
var pairing_js_1 = require("./pairing.js");
var logger_js_1 = require("../util/logger.js");
exports.DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
exports.CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
// ---------------------------------------------------------------------------
// Account ID compatibility (legacy raw ID → normalized ID)
// ---------------------------------------------------------------------------
/**
 * Pattern-based reverse of normalizeWeixinAccountId for known weixin ID suffixes.
 * Used only as a compatibility fallback when loading accounts / sync bufs stored
 * under the old raw ID.
 * e.g. "b0f5860fdecb-im-bot" → "b0f5860fdecb@im.bot"
 */
function deriveRawAccountId(normalizedId) {
    if (normalizedId.endsWith("-im-bot")) {
        return "".concat(normalizedId.slice(0, -7), "@im.bot");
    }
    if (normalizedId.endsWith("-im-wechat")) {
        return "".concat(normalizedId.slice(0, -10), "@im.wechat");
    }
    return undefined;
}
// ---------------------------------------------------------------------------
// Account index (persistent list of registered account IDs)
// ---------------------------------------------------------------------------
function resolveWeixinStateDir() {
    return node_path_1.default.join((0, state_dir_js_1.resolveStateDir)(), "openclaw-weixin");
}
function resolveAccountIndexPath() {
    return node_path_1.default.join(resolveWeixinStateDir(), "accounts.json");
}
/** Returns all accountIds registered via QR login. */
function listIndexedWeixinAccountIds() {
    var filePath = resolveAccountIndexPath();
    try {
        if (!node_fs_1.default.existsSync(filePath))
            return [];
        var raw = node_fs_1.default.readFileSync(filePath, "utf-8");
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter(function (id) { return typeof id === "string" && id.trim() !== ""; });
    }
    catch (_a) {
        return [];
    }
}
/** Add accountId to the persistent index (no-op if already present). */
function registerWeixinAccountId(accountId) {
    var dir = resolveWeixinStateDir();
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    var existing = listIndexedWeixinAccountIds();
    if (existing.includes(accountId))
        return;
    var updated = __spreadArray(__spreadArray([], existing, true), [accountId], false);
    node_fs_1.default.writeFileSync(resolveAccountIndexPath(), JSON.stringify(updated, null, 2), "utf-8");
}
/** Remove accountId from the persistent index. */
function unregisterWeixinAccountId(accountId) {
    var existing = listIndexedWeixinAccountIds();
    var updated = existing.filter(function (id) { return id !== accountId; });
    if (updated.length !== existing.length) {
        node_fs_1.default.writeFileSync(resolveAccountIndexPath(), JSON.stringify(updated, null, 2), "utf-8");
    }
}
/**
 * Remove stale accounts that share the same userId as the newly-bound account.
 * Called after a successful QR login to ensure only the latest account remains
 * for a given WeChat user, preventing ambiguous contextToken matches.
 *
 * @param onClearContextTokens callback to clear context tokens for the removed account
 */
function clearStaleAccountsForUserId(currentAccountId, userId, onClearContextTokens) {
    var _a;
    if (!userId)
        return;
    var allIds = listIndexedWeixinAccountIds();
    for (var _i = 0, allIds_1 = allIds; _i < allIds_1.length; _i++) {
        var id = allIds_1[_i];
        if (id === currentAccountId)
            continue;
        var data = loadWeixinAccount(id);
        if (((_a = data === null || data === void 0 ? void 0 : data.userId) === null || _a === void 0 ? void 0 : _a.trim()) === userId) {
            logger_js_1.logger.info("clearStaleAccountsForUserId: removing stale account=".concat(id, " (same userId=").concat(userId, ")"));
            onClearContextTokens === null || onClearContextTokens === void 0 ? void 0 : onClearContextTokens(id);
            clearWeixinAccount(id);
            unregisterWeixinAccountId(id);
        }
    }
}
function resolveAccountsDir() {
    return node_path_1.default.join(resolveWeixinStateDir(), "accounts");
}
function resolveAccountPath(accountId) {
    return node_path_1.default.join(resolveAccountsDir(), "".concat(accountId, ".json"));
}
/**
 * Legacy single-file token: `credentials/openclaw-weixin/credentials.json` (pre per-account files).
 */
function loadLegacyToken() {
    var legacyPath = node_path_1.default.join((0, state_dir_js_1.resolveStateDir)(), "credentials", "openclaw-weixin", "credentials.json");
    try {
        if (!node_fs_1.default.existsSync(legacyPath))
            return undefined;
        var raw = node_fs_1.default.readFileSync(legacyPath, "utf-8");
        var parsed = JSON.parse(raw);
        return typeof parsed.token === "string" ? parsed.token : undefined;
    }
    catch (_a) {
        return undefined;
    }
}
function readAccountFile(filePath) {
    try {
        if (node_fs_1.default.existsSync(filePath)) {
            return JSON.parse(node_fs_1.default.readFileSync(filePath, "utf-8"));
        }
    }
    catch (_a) {
        // ignore
    }
    return null;
}
/** Load account data by ID, with compatibility fallbacks. */
function loadWeixinAccount(accountId) {
    // Primary: try given accountId (normalized IDs written after this change).
    var primary = readAccountFile(resolveAccountPath(accountId));
    if (primary)
        return primary;
    // Compatibility: if the given ID is normalized, derive the old raw filename
    // (e.g. "b0f5860fdecb-im-bot" → "b0f5860fdecb@im.bot") for existing installs.
    var rawId = deriveRawAccountId(accountId);
    if (rawId) {
        var compat = readAccountFile(resolveAccountPath(rawId));
        if (compat)
            return compat;
    }
    // Legacy fallback: read token from old single-account credentials file.
    var token = loadLegacyToken();
    if (token)
        return { token: token };
    return null;
}
/**
 * Persist account data after QR login (merges into existing file).
 * - token: overwritten when provided.
 * - baseUrl: stored when non-empty; resolveWeixinAccount falls back to DEFAULT_BASE_URL.
 * - userId: set when `update.userId` is provided; omitted from file when cleared to empty.
 */
function saveWeixinAccount(accountId, update) {
    var _a, _b, _c, _d;
    var dir = resolveAccountsDir();
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    var existing = (_a = loadWeixinAccount(accountId)) !== null && _a !== void 0 ? _a : {};
    var token = ((_b = update.token) === null || _b === void 0 ? void 0 : _b.trim()) || existing.token;
    var baseUrl = ((_c = update.baseUrl) === null || _c === void 0 ? void 0 : _c.trim()) || existing.baseUrl;
    var userId = update.userId !== undefined
        ? update.userId.trim() || undefined
        : ((_d = existing.userId) === null || _d === void 0 ? void 0 : _d.trim()) || undefined;
    var data = __assign(__assign(__assign({}, (token ? { token: token, savedAt: new Date().toISOString() } : {})), (baseUrl ? { baseUrl: baseUrl } : {})), (userId ? { userId: userId } : {}));
    var filePath = resolveAccountPath(accountId);
    node_fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    try {
        node_fs_1.default.chmodSync(filePath, 384);
    }
    catch (_e) {
        // best-effort
    }
}
/**
 * Remove all files associated with an account:
 *   - accounts/{accountId}.json                  (credentials)
 *   - accounts/{accountId}.sync.json             (getUpdates sync buf)
 *   - accounts/{accountId}.context-tokens.json   (context tokens on disk)
 *   - credentials/openclaw-weixin-{accountId}-allowFrom.json (authorized users)
 */
function clearWeixinAccount(accountId) {
    var dir = resolveAccountsDir();
    var accountFiles = [
        "".concat(accountId, ".json"),
        "".concat(accountId, ".sync.json"),
        "".concat(accountId, ".context-tokens.json"),
    ];
    for (var _i = 0, accountFiles_1 = accountFiles; _i < accountFiles_1.length; _i++) {
        var file = accountFiles_1[_i];
        try {
            node_fs_1.default.unlinkSync(node_path_1.default.join(dir, file));
        }
        catch (_a) {
            // ignore if not found
        }
    }
    try {
        node_fs_1.default.unlinkSync((0, pairing_js_1.resolveFrameworkAllowFromPath)(accountId));
    }
    catch (_b) {
        // ignore if not found
    }
}
/**
 * Resolve the openclaw.json config file path.
 * Checks OPENCLAW_CONFIG env var, then state dir.
 */
function resolveConfigPath() {
    var _a;
    var envPath = (_a = process.env.OPENCLAW_CONFIG) === null || _a === void 0 ? void 0 : _a.trim();
    if (envPath)
        return envPath;
    return node_path_1.default.join((0, state_dir_js_1.resolveStateDir)(), "openclaw.json");
}
/**
 * Read `routeTag` from openclaw.json (for callers without an `OpenClawConfig` object).
 * Checks per-account `channels.<id>.accounts[accountId].routeTag` first, then section-level
 * `channels.<id>.routeTag`. Matches `feat_weixin_extension` behavior; channel key is `"openclaw-weixin"`.
 *
 * The config is cached after the first read since routeTag does not change at runtime.
 */
var cachedRouteTagSection;
function loadRouteTagSection() {
    var _a;
    if (cachedRouteTagSection !== undefined)
        return cachedRouteTagSection;
    try {
        var configPath = resolveConfigPath();
        if (!node_fs_1.default.existsSync(configPath)) {
            cachedRouteTagSection = null;
            return null;
        }
        var raw = node_fs_1.default.readFileSync(configPath, "utf-8");
        var cfg = JSON.parse(raw);
        var channels = cfg.channels;
        var section = (_a = channels === null || channels === void 0 ? void 0 : channels["openclaw-weixin"]) !== null && _a !== void 0 ? _a : null;
        cachedRouteTagSection = section;
        return section;
    }
    catch (_b) {
        cachedRouteTagSection = null;
        return null;
    }
}
function loadConfigRouteTag(accountId) {
    var _a;
    var section = loadRouteTagSection();
    if (!section)
        return undefined;
    if (accountId) {
        var accounts = section.accounts;
        var tag = (_a = accounts === null || accounts === void 0 ? void 0 : accounts[accountId]) === null || _a === void 0 ? void 0 : _a.routeTag;
        if (typeof tag === "number")
            return String(tag);
        if (typeof tag === "string" && tag.trim())
            return tag.trim();
    }
    if (typeof section.routeTag === "number")
        return String(section.routeTag);
    return typeof section.routeTag === "string" && section.routeTag.trim()
        ? section.routeTag.trim()
        : undefined;
}
/**
 * Ensure the openclaw-weixin channel section exists in openclaw.json so the gateway
 * recognises it as a configured channel at startup, then trigger a config reload.
 */
function triggerWeixinChannelReload() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, loadConfig, writeConfigFile, cfg, channels, updated, err_1;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("openclaw/plugin-sdk/config-runtime"); })];
                case 1:
                    _a = _d.sent(), loadConfig = _a.loadConfig, writeConfigFile = _a.writeConfigFile;
                    cfg = loadConfig();
                    channels = ((_b = cfg.channels) !== null && _b !== void 0 ? _b : {});
                    if (!(!channels["openclaw-weixin"] || Object.keys(channels["openclaw-weixin"]).every(function (k) { return k === "enabled"; }))) return [3 /*break*/, 3];
                    updated = __assign(__assign({}, cfg), { channels: __assign(__assign({}, channels), { "openclaw-weixin": __assign(__assign({}, ((_c = channels["openclaw-weixin"]) !== null && _c !== void 0 ? _c : {})), { accounts: {} }) }) });
                    return [4 /*yield*/, writeConfigFile(updated)];
                case 2:
                    _d.sent();
                    logger_js_1.logger.info("triggerWeixinChannelReload: wrote channel config to openclaw.json");
                    _d.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    err_1 = _d.sent();
                    logger_js_1.logger.warn("triggerWeixinChannelReload: failed to update config: ".concat(String(err_1)));
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/** List accountIds from the index file (written at QR login). */
function listWeixinAccountIds(_cfg) {
    return listIndexedWeixinAccountIds();
}
/** Resolve a weixin account by ID, merging config and stored credentials. */
function resolveWeixinAccount(cfg, accountId) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var raw = accountId === null || accountId === void 0 ? void 0 : accountId.trim();
    if (!raw) {
        throw new Error("weixin: accountId is required (no default account)");
    }
    var id = (0, account_id_1.normalizeAccountId)(raw);
    var section = (_a = cfg.channels) === null || _a === void 0 ? void 0 : _a["openclaw-weixin"];
    var accountCfg = (_d = (_c = (_b = section === null || section === void 0 ? void 0 : section.accounts) === null || _b === void 0 ? void 0 : _b[id]) !== null && _c !== void 0 ? _c : section) !== null && _d !== void 0 ? _d : {};
    var accountData = loadWeixinAccount(id);
    var token = ((_e = accountData === null || accountData === void 0 ? void 0 : accountData.token) === null || _e === void 0 ? void 0 : _e.trim()) || undefined;
    var stateBaseUrl = ((_f = accountData === null || accountData === void 0 ? void 0 : accountData.baseUrl) === null || _f === void 0 ? void 0 : _f.trim()) || "";
    return {
        accountId: id,
        baseUrl: stateBaseUrl || exports.DEFAULT_BASE_URL,
        cdnBaseUrl: ((_g = accountCfg.cdnBaseUrl) === null || _g === void 0 ? void 0 : _g.trim()) || exports.CDN_BASE_URL,
        token: token,
        enabled: accountCfg.enabled !== false,
        configured: Boolean(token),
        name: ((_h = accountCfg.name) === null || _h === void 0 ? void 0 : _h.trim()) || undefined,
    };
}
