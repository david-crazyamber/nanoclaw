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
exports.resolveFrameworkAllowFromPath = resolveFrameworkAllowFromPath;
exports.readFrameworkAllowFromList = readFrameworkAllowFromList;
exports.registerUserInFrameworkStore = registerUserInFrameworkStore;
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var infra_runtime_1 = require("openclaw/plugin-sdk/infra-runtime");
var state_dir_js_1 = require("../storage/state-dir.js");
var logger_js_1 = require("../util/logger.js");
/**
 * Resolve the framework credentials directory (mirrors core resolveOAuthDir).
 * Path: $OPENCLAW_OAUTH_DIR || $OPENCLAW_STATE_DIR/credentials || ~/.openclaw/credentials
 */
function resolveCredentialsDir() {
    var _a;
    var override = (_a = process.env.OPENCLAW_OAUTH_DIR) === null || _a === void 0 ? void 0 : _a.trim();
    if (override)
        return override;
    return node_path_1.default.join((0, state_dir_js_1.resolveStateDir)(), "credentials");
}
/**
 * Sanitize a channel/account key for safe use in filenames (mirrors core safeChannelKey).
 */
function safeKey(raw) {
    var trimmed = raw.trim().toLowerCase();
    if (!trimmed)
        throw new Error("invalid key for allowFrom path");
    var safe = trimmed.replace(/[\\/:*?"<>|]/g, "_").replace(/\.\./g, "_");
    if (!safe || safe === "_")
        throw new Error("invalid key for allowFrom path");
    return safe;
}
/**
 * Resolve the framework allowFrom file path for a given account.
 * Mirrors: `resolveAllowFromPath(channel, env, accountId)` from core.
 * Path: `<credDir>/openclaw-weixin-<accountId>-allowFrom.json`
 */
function resolveFrameworkAllowFromPath(accountId) {
    var base = safeKey("openclaw-weixin");
    var safeAccount = safeKey(accountId);
    return node_path_1.default.join(resolveCredentialsDir(), "".concat(base, "-").concat(safeAccount, "-allowFrom.json"));
}
/**
 * Read the framework allowFrom list for an account (user IDs authorized via pairing).
 * Returns an empty array when the file is missing or unreadable.
 */
function readFrameworkAllowFromList(accountId) {
    var filePath = resolveFrameworkAllowFromPath(accountId);
    try {
        if (!node_fs_1.default.existsSync(filePath))
            return [];
        var raw = node_fs_1.default.readFileSync(filePath, "utf-8");
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed.allowFrom)) {
            return parsed.allowFrom.filter(function (id) { return typeof id === "string" && id.trim() !== ""; });
        }
    }
    catch (_a) {
        // best-effort
    }
    return [];
}
/** File lock options matching the framework's pairing store lock settings. */
var LOCK_OPTIONS = {
    retries: { retries: 3, factor: 2, minTimeout: 100, maxTimeout: 2000 },
    stale: 10000,
};
/**
 * Register a user ID in the framework's channel allowFrom store.
 * This writes directly to the same JSON file that `readChannelAllowFromStore` reads,
 * making the user visible to the framework authorization pipeline.
 *
 * Uses file locking to avoid races with concurrent readers/writers.
 */
function registerUserInFrameworkStore(params) {
    return __awaiter(this, void 0, void 0, function () {
        var accountId, userId, trimmedUserId, filePath, dir, initial;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    accountId = params.accountId, userId = params.userId;
                    trimmedUserId = userId.trim();
                    if (!trimmedUserId)
                        return [2 /*return*/, { changed: false }];
                    filePath = resolveFrameworkAllowFromPath(accountId);
                    dir = node_path_1.default.dirname(filePath);
                    node_fs_1.default.mkdirSync(dir, { recursive: true });
                    // Ensure the file exists before locking
                    if (!node_fs_1.default.existsSync(filePath)) {
                        initial = { version: 1, allowFrom: [] };
                        node_fs_1.default.writeFileSync(filePath, JSON.stringify(initial, null, 2), "utf-8");
                    }
                    return [4 /*yield*/, (0, infra_runtime_1.withFileLock)(filePath, LOCK_OPTIONS, function () { return __awaiter(_this, void 0, void 0, function () {
                            var content, raw, parsed;
                            return __generator(this, function (_a) {
                                content = { version: 1, allowFrom: [] };
                                try {
                                    raw = node_fs_1.default.readFileSync(filePath, "utf-8");
                                    parsed = JSON.parse(raw);
                                    if (Array.isArray(parsed.allowFrom)) {
                                        content = parsed;
                                    }
                                }
                                catch (_b) {
                                    // If read/parse fails, start fresh
                                }
                                if (content.allowFrom.includes(trimmedUserId)) {
                                    return [2 /*return*/, { changed: false }];
                                }
                                content.allowFrom.push(trimmedUserId);
                                node_fs_1.default.writeFileSync(filePath, JSON.stringify(content, null, 2), "utf-8");
                                logger_js_1.logger.info("registerUserInFrameworkStore: added userId=".concat(trimmedUserId, " accountId=").concat(accountId, " path=").concat(filePath));
                                return [2 /*return*/, { changed: true }];
                            });
                        }); })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
