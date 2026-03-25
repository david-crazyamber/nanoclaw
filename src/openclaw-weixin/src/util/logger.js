"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.setLogLevel = setLogLevel;
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var infra_runtime_1 = require("openclaw/plugin-sdk/infra-runtime");
/**
 * Plugin logger — writes JSON lines to the main openclaw log file:
 *   <tmpDir>/openclaw-YYYY-MM-DD.log
 * Same file and format used by all other channels.
 */
var MAIN_LOG_DIR = (0, infra_runtime_1.resolvePreferredOpenClawTmpDir)();
var SUBSYSTEM = "gateway/channels/openclaw-weixin";
var RUNTIME = "node";
var RUNTIME_VERSION = process.versions.node;
var HOSTNAME = node_os_1.default.hostname() || "unknown";
var PARENT_NAMES = ["openclaw"];
/** tslog-compatible level IDs (higher = more severe). */
var LEVEL_IDS = {
    TRACE: 1,
    DEBUG: 2,
    INFO: 3,
    WARN: 4,
    ERROR: 5,
    FATAL: 6,
};
var DEFAULT_LOG_LEVEL = "INFO";
function resolveMinLevel() {
    var _a;
    var env = (_a = process.env.OPENCLAW_LOG_LEVEL) === null || _a === void 0 ? void 0 : _a.toUpperCase();
    if (env && env in LEVEL_IDS)
        return LEVEL_IDS[env];
    return LEVEL_IDS[DEFAULT_LOG_LEVEL];
}
var minLevelId = resolveMinLevel();
/** Dynamically change the minimum log level at runtime. */
function setLogLevel(level) {
    var upper = level.toUpperCase();
    if (!(upper in LEVEL_IDS)) {
        throw new Error("Invalid log level: ".concat(level, ". Valid levels: ").concat(Object.keys(LEVEL_IDS).join(", ")));
    }
    minLevelId = LEVEL_IDS[upper];
}
/** Shift a Date into local time so toISOString() renders local clock digits. */
function toLocalISO(now) {
    var offsetMs = -now.getTimezoneOffset() * 60000;
    var sign = offsetMs >= 0 ? "+" : "-";
    var abs = Math.abs(now.getTimezoneOffset());
    var offStr = "".concat(sign).concat(String(Math.floor(abs / 60)).padStart(2, "0"), ":").concat(String(abs % 60).padStart(2, "0"));
    return new Date(now.getTime() + offsetMs).toISOString().replace("Z", offStr);
}
function localDateKey(now) {
    return toLocalISO(now).slice(0, 10);
}
function resolveMainLogPath() {
    var dateKey = localDateKey(new Date());
    return node_path_1.default.join(MAIN_LOG_DIR, "openclaw-".concat(dateKey, ".log"));
}
var logDirEnsured = false;
function buildLoggerName(accountId) {
    return accountId ? "".concat(SUBSYSTEM, "/").concat(accountId) : SUBSYSTEM;
}
function writeLog(level, message, accountId) {
    var _a, _b;
    var levelId = (_a = LEVEL_IDS[level]) !== null && _a !== void 0 ? _a : LEVEL_IDS.INFO;
    if (levelId < minLevelId)
        return;
    var now = new Date();
    var loggerName = buildLoggerName(accountId);
    var prefixedMessage = accountId ? "[".concat(accountId, "] ").concat(message) : message;
    var entry = JSON.stringify({
        "0": loggerName,
        "1": prefixedMessage,
        _meta: {
            runtime: RUNTIME,
            runtimeVersion: RUNTIME_VERSION,
            hostname: HOSTNAME,
            name: loggerName,
            parentNames: PARENT_NAMES,
            date: now.toISOString(),
            logLevelId: (_b = LEVEL_IDS[level]) !== null && _b !== void 0 ? _b : LEVEL_IDS.INFO,
            logLevelName: level,
        },
        time: toLocalISO(now),
    });
    try {
        if (!logDirEnsured) {
            node_fs_1.default.mkdirSync(MAIN_LOG_DIR, { recursive: true });
            logDirEnsured = true;
        }
        node_fs_1.default.appendFileSync(resolveMainLogPath(), "".concat(entry, "\n"), "utf-8");
    }
    catch (_c) {
        // Best-effort; never block on logging failures.
    }
}
/** Creates a logger instance, optionally bound to a specific account. */
function createLogger(accountId) {
    return {
        info: function (message) {
            writeLog("INFO", message, accountId);
        },
        debug: function (message) {
            writeLog("DEBUG", message, accountId);
        },
        warn: function (message) {
            writeLog("WARN", message, accountId);
        },
        error: function (message) {
            writeLog("ERROR", message, accountId);
        },
        withAccount: function (id) {
            return createLogger(id);
        },
        getLogFilePath: function () {
            return resolveMainLogPath();
        },
        close: function () {
            // No-op: appendFileSync has no persistent handle to close.
        },
    };
}
exports.logger = createLogger();
