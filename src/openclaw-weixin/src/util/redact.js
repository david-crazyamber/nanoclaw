"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncate = truncate;
exports.redactToken = redactToken;
exports.redactBody = redactBody;
exports.redactUrl = redactUrl;
var DEFAULT_BODY_MAX_LEN = 200;
var DEFAULT_TOKEN_PREFIX_LEN = 6;
/**
 * Truncate a string, appending a length indicator when trimmed.
 * Returns `""` for empty/undefined input.
 */
function truncate(s, max) {
    if (!s)
        return "";
    if (s.length <= max)
        return s;
    return "".concat(s.slice(0, max), "\u2026(len=").concat(s.length, ")");
}
/**
 * Redact a token/secret: show only the first few chars + total length.
 * Returns `"(none)"` when absent.
 */
function redactToken(token, prefixLen) {
    if (prefixLen === void 0) { prefixLen = DEFAULT_TOKEN_PREFIX_LEN; }
    if (!token)
        return "(none)";
    if (token.length <= prefixLen)
        return "****(len=".concat(token.length, ")");
    return "".concat(token.slice(0, prefixLen), "\u2026(len=").concat(token.length, ")");
}
/** Field names whose values should be masked in logged JSON bodies. */
var SENSITIVE_FIELDS = /\b(context_token|bot_token|token|authorization|Authorization)\b/;
/**
 * Truncate a JSON body string to `maxLen` chars for safe logging.
 * Redacts known sensitive fields before truncating.
 */
function redactBody(body, maxLen) {
    if (maxLen === void 0) { maxLen = DEFAULT_BODY_MAX_LEN; }
    if (!body)
        return "(empty)";
    // Mask values of known sensitive JSON keys: "key":"value" → "key":"<redacted>"
    var redacted = body.replace(/"(context_token|bot_token|token|authorization|Authorization)"\s*:\s*"[^"]*"/g, '"$1":"<redacted>"');
    if (redacted.length <= maxLen)
        return redacted;
    return "".concat(redacted.slice(0, maxLen), "\u2026(truncated, totalLen=").concat(redacted.length, ")");
}
/**
 * Strip query string (which often contains signatures/tokens) from a URL,
 * keeping only origin + pathname.
 */
function redactUrl(rawUrl) {
    try {
        var u = new URL(rawUrl);
        var base = "".concat(u.origin).concat(u.pathname);
        return u.search ? "".concat(base, "?<redacted>") : base;
    }
    catch (_a) {
        return truncate(rawUrl, 80);
    }
}
