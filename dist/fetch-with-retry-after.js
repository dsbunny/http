"use strict";
// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch_with_retry_after = exports.fetch_with_log = void 0;
const node_stream_1 = require("node:stream");
// @ts-expect-error
const node_util_1 = require("node:util");
const retry_js_1 = require("./retry.js");
function style_for_status(status) {
    if (status >= 200 && status < 300) {
        return 'green';
    }
    else if (status >= 300 && status < 400) {
        return 'yellow';
    }
    else if (status >= 400 && status < 600) {
        return 'red';
    }
    else {
        return 'grey';
    }
}
async function fetch_with_log(url, init) {
    const request_headers = Array.from(new Headers(init?.headers ?? {}).entries());
    console.log((0, node_util_1.styleText)('grey', `${init?.method ?? 'GET'} ${url}
${request_headers.map(([key, value]) => `${key}: ${value}`).join('\n')}
${(!init || !init.body || (init.body instanceof node_stream_1.Readable)) ? '' : init.body}
`));
    const response = await fetch(url, init);
    // Serialize the headers to a string
    const response_headers = Array.from(response.headers.entries());
    if ((response.status >= 400 && response.status < 600)
        || (init && 'logBody' in init && init.logBody)) {
        const text = await response.clone().text();
        console.log((0, node_util_1.styleText)(style_for_status(response.status), `HTTP ${response.status} ${response.statusText}
${response_headers.map(([key, value]) => `${key}: ${value}`).join('\n')}
${text}`));
    }
    else {
        console.log((0, node_util_1.styleText)(style_for_status(response.status), `HTTP ${response.status} ${response.statusText}
${response_headers.map(([key, value]) => `${key}: ${value}`).join('\n')}`));
    }
    return response;
}
exports.fetch_with_log = fetch_with_log;
async function fetch_with_timeout(url, init) {
    if (init?.timeout) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), init.timeout);
        try {
            return await fetch_with_log(url, { ...init, signal: controller.signal });
        }
        finally {
            clearTimeout(id);
        }
    }
    else {
        return await fetch_with_log(url, init);
    }
}
async function fetch_with_retry_after(url, init) {
    const timeout = init?.timeout || 0;
    const retryCount = init?.retryCount || 0;
    const retryMinDelay = init?.retryMinDelay || 0;
    const retryMaxDelay = init?.retryMaxDelay || 0;
    const attempt = init?.attempt || 1;
    if (retryCount && (!retryMinDelay || !retryMaxDelay)) {
        throw new Error('retryMinDelay and retryMaxDelay are required when retryCount is set.');
    }
    try {
        const response = await fetch_with_timeout(url, {
            ...init,
            timeout,
        });
        if (retryCount > 0
            && response.status >= 500 && response.status < 600) {
            let sleep_ms = 0;
            const retry_after = response.headers.get('Retry-After');
            if (retry_after) {
                let base = 0;
                let date = Date.parse(retry_after);
                if (isNaN(date)) {
                    const delay_seconds = parseInt(retry_after);
                    if (delay_seconds) {
                        base = delay_seconds * 1000;
                    }
                }
                else {
                    base = date - Date.now();
                }
                // Force the base to be within the range of the min and max delay.
                base = Math.max(retryMinDelay, Math.min(retryMaxDelay, base));
                const cap = retryMaxDelay;
                // Exponential backoff with jitter.
                const temp = Math.min(cap, base * 2 ** attempt);
                sleep_ms = temp / 2 + (0, retry_js_1.random_between)(0, temp / 2);
                sleep_ms = Math.min(cap, (0, retry_js_1.random_between)(base, sleep_ms * 3));
            }
            else {
                sleep_ms = (0, retry_js_1.exponential_backoff_with_jitter)(retryMinDelay, retryMaxDelay, attempt);
            }
            console.warn((0, node_util_1.styleText)('yellow', `[retry] Retry attempt ${attempt} after ${Math.floor(sleep_ms)}ms`));
            await (0, retry_js_1.wait)(sleep_ms);
            return fetch_with_retry_after(url, {
                ...init,
                timeout,
                retryCount: retryCount - 1,
                retryMinDelay,
                retryMaxDelay,
                attempt: attempt + 1,
            });
        }
        return response;
    }
    catch (error) {
        if (retryCount > 0) {
            const sleep_ms = (0, retry_js_1.exponential_backoff_with_jitter)(retryMinDelay, retryMaxDelay, attempt);
            console.warn((0, node_util_1.styleText)('yellow', `[retry] Retry attempt ${attempt} after ${Math.floor(sleep_ms)}ms`));
            await (0, retry_js_1.wait)(sleep_ms);
            return fetch_with_retry_after(url, {
                ...init,
                timeout,
                retryCount: retryCount - 1,
                retryMinDelay,
                retryMaxDelay,
                attempt: attempt + 1,
            });
        }
        console.warn((0, node_util_1.styleText)('red', '[retry] Retry failed.'));
        throw error;
    }
}
exports.fetch_with_retry_after = fetch_with_retry_after;
//# sourceMappingURL=fetch-with-retry-after.js.map