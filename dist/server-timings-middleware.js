"use strict";
// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
// Automatically generate HTTP "Server-Timing" headers for each request.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverTimings = void 0;
const on_headers_1 = __importDefault(require("on-headers"));
;
// API assumes that upon setting of response headers, processing is complete.
// Using HTTP trailers would be more appropriate, but they required chunked
// encoding, and may not be supported by the client.
function serverTimings() {
    return (req, res, next) => {
        const start = process.hrtime.bigint();
        const timings = new Map();
        const endedTimings = [];
        res.locals.timings = {
            start(name) {
                timings.set(name, process.hrtime.bigint());
            },
            end(name) {
                const start = timings.get(name);
                if (typeof start === "undefined") {
                    throw new Error(`No start time for "${name}"`);
                }
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1e6;
                const rounded = Math.round(duration * 100 + Number.EPSILON) / 100;
                endedTimings.push([name, rounded]);
            },
            add(name, duration, description) {
                endedTimings.push([
                    name,
                    typeof duration !== "undefined"
                        ? Math.round(duration * 100 + Number.EPSILON) / 100
                        : undefined,
                    description,
                ]);
                return this;
            },
        };
        (0, on_headers_1.default)(res, () => {
            const values = [];
            for (const [name, duration, description] of endedTimings) {
                const metrics = [name];
                if (typeof duration !== "undefined") {
                    metrics.push(`dur=${duration}`);
                }
                if (typeof description !== "undefined") {
                    metrics.push(`desc="${description}"`);
                }
                values.push(metrics.join(";"));
            }
            if (values.length > 0) {
                res.append("Server-Timing", values.join(", "));
            }
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1e6;
            const rounded = Math.round(duration * 100 + Number.EPSILON) / 100;
            res.append("Server-Timing", `total;dur=${rounded}`);
        });
        next();
    };
}
exports.serverTimings = serverTimings;
//# sourceMappingURL=server-timings-middleware.js.map