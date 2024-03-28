"use strict";
// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
// REF: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute_with_retry = exports.retry = exports.exponential_backoff_with_jitter = exports.random_between = exports.wait = void 0;
// @ts-expect-error
const node_util_1 = require("node:util");
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.wait = wait;
function random_between(min, max) {
    return Math.random() * (max - min) + min;
}
exports.random_between = random_between;
function exponential_backoff_with_jitter(base, cap, attempt) {
    const temp = Math.min(cap, base * 2 ** attempt);
    const sleep_ms = temp / 2 + random_between(0, temp / 2);
    return Math.min(cap, random_between(base, sleep_ms * 3));
}
exports.exponential_backoff_with_jitter = exponential_backoff_with_jitter;
async function retry(fn, retryCount, minDelay, maxDelay, attempt = 1) {
    try {
        return await fn();
    }
    catch (error) {
        if (retryCount > 0) {
            const sleep_ms = exponential_backoff_with_jitter(minDelay, maxDelay, attempt);
            console.warn((0, node_util_1.styleText)('yellow', `[retry] Retry attempt ${attempt} after ${Math.floor(sleep_ms)}ms`));
            await wait(sleep_ms);
            return retry(fn, retryCount - 1, minDelay, maxDelay, attempt + 1);
        }
        console.warn((0, node_util_1.styleText)('red', '[retry] Retry failed.'));
        throw error;
    }
}
exports.retry = retry;
async function execute_with_retry(func, paramSets, maxConcurrency, retryCount, retryMinDelay, retryMaxDelay) {
    const results = [];
    async function executeOne(params) {
        const result = await retry(() => func(...params), retryCount, retryMinDelay, retryMaxDelay);
        results.push(result);
    }
    const promises = [];
    for (const paramSet of paramSets) {
        while (promises.length >= maxConcurrency) {
            await Promise.race(promises);
            promises.length = promises.findIndex(promise => promise === undefined); // Remove completed promises
        }
        promises.push(executeOne(paramSet));
    }
    // Wait for remaining promises to complete
    await Promise.all(promises);
    return results;
}
exports.execute_with_retry = execute_with_retry;
//# sourceMappingURL=retry.js.map