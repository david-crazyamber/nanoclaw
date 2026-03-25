"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStateDir = resolveStateDir;
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
/** Resolve the OpenClaw state directory (mirrors core logic in src/infra). */
function resolveStateDir() {
    var _a, _b;
    return (((_a = process.env.OPENCLAW_STATE_DIR) === null || _a === void 0 ? void 0 : _a.trim()) ||
        ((_b = process.env.CLAWDBOT_STATE_DIR) === null || _b === void 0 ? void 0 : _b.trim()) ||
        node_path_1.default.join(node_os_1.default.homedir(), ".openclaw"));
}
