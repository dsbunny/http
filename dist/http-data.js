"use strict";
// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchDataOnce = exports.patchData = exports.postDataOnce = exports.postData = exports.getDataOnce = exports.getData = exports.putDataOnce = exports.putData = void 0;
const fetch_with_circuit_breaker_js_1 = require("./fetch-with-circuit-breaker.js");
const retry_js_1 = require("./retry.js");
const MAX_RETRY_COUNT = 3;
const BACKOFF_MIN_INTERVAL = 15 * 1000;
const BACKOFF_MAX_INTERVAL = 300 * 1000;
async function putData(url, data, init) {
    const response = await (0, retry_js_1.retry)(() => putDataOnce(url, data, init), MAX_RETRY_COUNT, BACKOFF_MIN_INTERVAL, BACKOFF_MAX_INTERVAL);
    return response;
}
exports.putData = putData;
async function putDataOnce(url, data, init) {
    const ETag = `"${Buffer.from(init.contentMd5, 'base64').toString('hex')}"`;
    const response = await (0, fetch_with_circuit_breaker_js_1.fetch_with_circuit_breaker)(url, {
        method: 'PUT',
        headers: {
            ...(init.authorization && {
                'Authorization': init.authorization,
            }),
            ...(init.identity && {
                'x-amzn-oidc-identity': init.identity,
            }),
            'If-None-Match': ETag,
            'Accept': 'application/json',
            'Content-Type': init.contentType,
            'Content-Length': init.contentLength.toString(),
            'Content-MD5': init.contentMd5,
        },
        mode: 'cors',
        cache: 'no-store',
        body: data,
        retryCount: MAX_RETRY_COUNT,
        retryMinDelay: BACKOFF_MIN_INTERVAL,
        retryMaxDelay: BACKOFF_MAX_INTERVAL,
    });
    // HTTP status code 412 Precondition Failed indicates that the resource
    // already exists, and the If-None-Match condition was not met.
    if (!response.ok || response.status === 412) {
        throw new Error(`HTTP status: ${response.status}`);
    }
    if (response.body === null) {
        throw new Error('Response body is null');
    }
    // REF: https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html#API_PutObject_ResponseSyntax
    //
    // "To ensure that data is not corrupted traversing the network, for
    // objects where the ETag is the MD5 digest of the object, you can
    // calculate the MD5 while putting an object to Amazon S3 and compare
    // the returned ETag to the calculated MD5 value."
    if (response.headers.get('ETag') !== ETag) {
        throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${ETag}`);
    }
    return response;
}
exports.putDataOnce = putDataOnce;
async function getData(url, init) {
    const response = await (0, retry_js_1.retry)(() => getDataOnce(url, init), MAX_RETRY_COUNT, BACKOFF_MIN_INTERVAL, BACKOFF_MAX_INTERVAL);
    return response;
}
exports.getData = getData;
async function getDataOnce(url, init) {
    const response = await (0, fetch_with_circuit_breaker_js_1.fetch_with_circuit_breaker)(url, {
        headers: {
            ...(init.authorization && {
                'Authorization': init.authorization,
            }),
            ...(init.identity && {
                'x-amzn-oidc-identity': init.identity,
            }),
            ...(init.ETag && {
                'If-Match': init.ETag,
            }),
            'Accept': init.accept,
        },
        mode: 'cors',
        cache: 'no-store',
        retryCount: MAX_RETRY_COUNT,
        retryMinDelay: BACKOFF_MIN_INTERVAL,
        retryMaxDelay: BACKOFF_MAX_INTERVAL,
    });
    if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
    }
    if (init.ETag
        && response.headers.get('ETag') !== init.ETag) {
        throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${init.ETag}`);
    }
    return response;
}
exports.getDataOnce = getDataOnce;
// Special case for POST requests.
async function postData(url, data, init) {
    const response = await (0, retry_js_1.retry)(() => postDataOnce(url, data, init), MAX_RETRY_COUNT, BACKOFF_MIN_INTERVAL, BACKOFF_MAX_INTERVAL);
    return response;
}
exports.postData = postData;
async function postDataOnce(url, data, init) {
    const response = await (0, fetch_with_circuit_breaker_js_1.fetch_with_circuit_breaker)(url, {
        method: 'POST',
        headers: {
            ...(init.authorization && {
                'Authorization': init.authorization,
            }),
            ...(init.identity && {
                'x-amzn-oidc-identity': init.identity,
            }),
            'Accept': 'application/json',
            'Content-Type': init.contentType,
            'Content-Length': init.contentLength.toString(),
        },
        mode: 'cors',
        cache: 'no-store',
        body: data,
        retryCount: MAX_RETRY_COUNT,
        retryMinDelay: BACKOFF_MIN_INTERVAL,
        retryMaxDelay: BACKOFF_MAX_INTERVAL,
    });
    // HTTP status code 412 Precondition Failed indicates that the resource
    // already exists, and the If-None-Match condition was not met.
    if (!response.ok || response.status === 412) {
        throw new Error(`HTTP status: ${response.status}`);
    }
    if (response.body === null) {
        throw new Error('Response body is null');
    }
    return response;
}
exports.postDataOnce = postDataOnce;
// Special case for PATCH requests.
async function patchData(url, data, init) {
    const response = await (0, retry_js_1.retry)(() => patchDataOnce(url, data, init), MAX_RETRY_COUNT, BACKOFF_MIN_INTERVAL, BACKOFF_MAX_INTERVAL);
    return response;
}
exports.patchData = patchData;
async function patchDataOnce(url, data, init) {
    const response = await (0, fetch_with_circuit_breaker_js_1.fetch_with_circuit_breaker)(url, {
        method: 'PATCH',
        headers: {
            ...(init.authorization && {
                'Authorization': init.authorization,
            }),
            ...(init.identity && {
                'x-amzn-oidc-identity': init.identity,
            }),
            'Accept': 'application/json',
            'Content-Type': init.contentType,
            'Content-Length': init.contentLength.toString(),
        },
        mode: 'cors',
        cache: 'no-store',
        body: data,
        retryCount: MAX_RETRY_COUNT,
        retryMinDelay: BACKOFF_MIN_INTERVAL,
        retryMaxDelay: BACKOFF_MAX_INTERVAL,
    });
    // HTTP status code 412 Precondition Failed indicates that the resource
    // already exists, and the If-None-Match condition was not met.
    if (!response.ok || response.status === 412) {
        throw new Error(`HTTP status: ${response.status}`);
    }
    if (response.body === null) {
        throw new Error('Response body is null');
    }
    return response;
}
exports.patchDataOnce = patchDataOnce;
//# sourceMappingURL=http-data.js.map