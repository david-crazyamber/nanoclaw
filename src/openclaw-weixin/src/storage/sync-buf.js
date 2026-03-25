"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSyncBufFilePath = getSyncBufFilePath;
exports.loadGetUpdatesBuf = loadGetUpdatesBuf;
exports.saveGetUpdatesBuf = saveGetUpdatesBuf;
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var accounts_js_1 = require("../auth/accounts.js");
var state_dir_js_1 = require("./state-dir.js");
function resolveAccountsDir() {
    return node_path_1.default.join((0, state_dir_js_1.resolveStateDir)(), "openclaw-weixin", "accounts");
}
/**
 * Path to the persistent get_updates_buf file for an account.
 * Stored alongside account data: ~/.openclaw/openclaw-weixin/accounts/{accountId}.sync.json
 */
function getSyncBufFilePath(accountId) {
    return node_path_1.default.join(resolveAccountsDir(), "".concat(accountId, ".sync.json"));
}
/** Legacy single-account syncbuf (pre multi-account): `.openclaw-weixin-sync/default.json`. */
function getLegacySyncBufDefaultJsonPath() {
    return node_path_1.default.join((0, state_dir_js_1.resolveStateDir)(), "agents", "default", "sessions", ".openclaw-weixin-sync", "default.json");
}
function readSyncBufFile(filePath) {
    try {
        var raw = node_fs_1.default.readFileSync(filePath, "utf-8");
        var data = JSON.parse(raw);
        if (typeof data.get_updates_buf === "string") {
            return data.get_updates_buf;
        }
    }
    catch (_a) {
        // file not found or invalid
    }
    return undefined;
}
/**
 * Load persisted get_updates_buf.
 * Falls back in order:
 *   1. Primary path (normalized accountId, new installs)
 *   2. Compat path (raw accountId derived from pattern, old installs)
 *   3. Legacy single-account path (very old installs without multi-account support)
 */
function loadGetUpdatesBuf(filePath) {
    var value = readSyncBufFile(filePath);
    if (value !== undefined)
        return value;
    // Compat: if given path uses a normalized accountId (e.g. "b0f5860fdecb-im-bot.sync.json"),
    // also try the old raw-ID filename (e.g. "b0f5860fdecb@im.bot.sync.json").
    var accountId = node_path_1.default.basename(filePath, ".sync.json");
    var rawId = (0, accounts_js_1.deriveRawAccountId)(accountId);
    if (rawId) {
        var compatPath = node_path_1.default.join(resolveAccountsDir(), "".concat(rawId, ".sync.json"));
        var compatValue = readSyncBufFile(compatPath);
        if (compatValue !== undefined)
            return compatValue;
    }
    // Legacy fallback: old single-account installs stored syncbuf without accountId.
    return readSyncBufFile(getLegacySyncBufDefaultJsonPath());
}
/**
 * Persist get_updates_buf. Creates parent dir if needed.
 */
function saveGetUpdatesBuf(filePath, getUpdatesBuf) {
    var dir = node_path_1.default.dirname(filePath);
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    node_fs_1.default.writeFileSync(filePath, JSON.stringify({ get_updates_buf: getUpdatesBuf }, null, 0), "utf-8");
}
