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
exports.setWeixinRuntime = setWeixinRuntime;
exports.getWeixinRuntime = getWeixinRuntime;
exports.waitForWeixinRuntime = waitForWeixinRuntime;
exports.resolveWeixinChannelRuntime = resolveWeixinChannelRuntime;
var logger_js_1 = require("./util/logger.js");
var pluginRuntime = null;
/**
 * Sets the global Weixin runtime (called from plugin register).
 */
function setWeixinRuntime(next) {
    pluginRuntime = next;
    logger_js_1.logger.info("[runtime] setWeixinRuntime called, runtime set successfully");
}
/**
 * Gets the global Weixin runtime (throws if not initialized).
 */
function getWeixinRuntime() {
    if (!pluginRuntime) {
        throw new Error("Weixin runtime not initialized");
    }
    return pluginRuntime;
}
var WAIT_INTERVAL_MS = 100;
var DEFAULT_TIMEOUT_MS = 10000;
/**
 * Waits for the Weixin runtime to be initialized (async polling).
 */
function waitForWeixinRuntime() {
    return __awaiter(this, arguments, void 0, function (timeoutMs) {
        var start;
        if (timeoutMs === void 0) { timeoutMs = DEFAULT_TIMEOUT_MS; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    start = Date.now();
                    _a.label = 1;
                case 1:
                    if (!!pluginRuntime) return [3 /*break*/, 3];
                    if (Date.now() - start > timeoutMs) {
                        throw new Error("Weixin runtime initialization timeout");
                    }
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, WAIT_INTERVAL_MS); })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/, pluginRuntime];
            }
        });
    });
}
/**
 * Resolves `PluginRuntime["channel"]` for the long-poll monitor.
 *
 * Prefer the gateway-injected `channelRuntime` on `ChannelGatewayContext` when present (avoids
 * races with the module-global from `register()`). Fall back to the global set by `setWeixinRuntime()`,
 * then to a short wait for legacy hosts.
 */
function resolveWeixinChannelRuntime(params) {
    return __awaiter(this, void 0, void 0, function () {
        var pr;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (params.channelRuntime) {
                        logger_js_1.logger.debug("[runtime] channelRuntime from gateway context");
                        return [2 /*return*/, params.channelRuntime];
                    }
                    if (pluginRuntime) {
                        logger_js_1.logger.debug("[runtime] channelRuntime from register() global");
                        return [2 /*return*/, pluginRuntime.channel];
                    }
                    logger_js_1.logger.warn("[runtime] no channelRuntime on ctx and no global runtime yet; waiting for register()");
                    return [4 /*yield*/, waitForWeixinRuntime((_a = params.waitTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_TIMEOUT_MS)];
                case 1:
                    pr = _b.sent();
                    return [2 /*return*/, pr.channel];
            }
        });
    });
}
