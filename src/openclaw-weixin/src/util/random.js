"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.tempFileName = tempFileName;
var node_crypto_1 = require("node:crypto");
/**
 * Generate a prefixed unique ID using timestamp + crypto random bytes.
 * Format: `{prefix}:{timestamp}-{8-char hex}`
 */
function generateId(prefix) {
    return "".concat(prefix, ":").concat(Date.now(), "-").concat(node_crypto_1.default.randomBytes(4).toString("hex"));
}
/**
 * Generate a temporary file name with random suffix.
 * Format: `{prefix}-{timestamp}-{8-char hex}{ext}`
 */
function tempFileName(prefix, ext) {
    return "".concat(prefix, "-").concat(Date.now(), "-").concat(node_crypto_1.default.randomBytes(4).toString("hex")).concat(ext);
}
