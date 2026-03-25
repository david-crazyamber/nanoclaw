"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var pino_1 = require("pino");
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } },
});
// Route uncaught errors through pino so they get timestamps in stderr
process.on('uncaughtException', function (err) {
    exports.logger.fatal({ err: err }, 'Uncaught exception');
    process.exit(1);
});
process.on('unhandledRejection', function (reason) {
    exports.logger.error({ err: reason }, 'Unhandled rejection');
});
