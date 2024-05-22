"use strict";
// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
// REF: https://docs.aws.amazon.com/AmazonS3/latest/userguide/example_s3_Scenario_UsingLargeFiles_section.html
// REF: https://docs.aws.amazon.com/whitepapers/latest/s3-optimizing-performance-best-practices/use-byte-range-fetches.html
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMultiPartFile = exports.putSinglePartFile = exports.putMultiPartFile = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_stream_1 = require("node:stream");
const promises_2 = require("node:stream/promises");
const fetch_with_circuit_breaker_js_1 = require("./fetch-with-circuit-breaker.js");
const retry_js_1 = require("./retry.js");
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_UPLOAD_PARTS = 10000;
const MAX_UPLOAD_PART_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_UPLOAD_CONCURRENCY = 10;
const MAX_DOWNLOAD_CONCURRENCY = 10;
const MAX_UPLOAD_TIME = 60 * 1000;
const MAX_DOWNLOAD_TIME = 60 * 1000;
const MAX_RETRY_COUNT = 3;
const BACKOFF_MIN_INTERVAL = 15 * 1000;
const BACKOFF_MAX_INTERVAL = 300 * 1000;
;
;
async function putMultiPartFile(parts, filePath, init) {
    const partCount = parts.length;
    const parameters = parts.map((part) => ([
        part.url,
        part.partNumber,
        part.start,
        part.end,
        part.contentLength,
        part.contentMd5,
    ]));
    const handle = await promises_1.default.open(filePath, 'r');
    const results = await (0, retry_js_1.execute_with_retry)(async (url, partNumber, start, end, contentLength, contentMd5) => {
        console.log(`Uploading part ${partNumber} of ${partCount} from ${start} to ${end}`);
        try {
            const ETag = `"${Buffer.from(contentMd5, 'base64').toString('hex')}"`;
            const response = await putPart(url, handle, {
                authorization: init.authorization,
                identity: init.identity,
                ETag,
                contentType: init.contentType,
                contentLength,
                contentMd5,
                logBody: init.logBody,
                start,
                end,
            });
            return { response, partNumber };
        }
        catch (error) {
            console.error(`Part ${partNumber} error: ${error}`);
            throw error;
        }
    }, parameters, MAX_UPLOAD_CONCURRENCY, MAX_RETRY_COUNT, BACKOFF_MIN_INTERVAL, BACKOFF_MAX_INTERVAL);
    console.log('All parts uploaded');
    await handle.close();
    return results;
}
exports.putMultiPartFile = putMultiPartFile;
async function putSinglePartFile(url, filePath, init) {
    const handle = await promises_1.default.open(filePath, 'r');
    let response = await (0, retry_js_1.retry)(() => {
        console.log('Uploading entire file');
        const ETag = `"${Buffer.from(init.contentMd5, 'base64').toString('hex')}"`;
        return putPart(url, handle, {
            authorization: init.authorization,
            identity: init.identity,
            ETag,
            contentType: init.contentType,
            contentLength: init.contentLength,
            contentMd5: init.contentMd5,
            logBody: init.logBody,
            start: 0,
            end: init.contentLength - 1,
        });
    }, MAX_RETRY_COUNT, BACKOFF_MIN_INTERVAL, BACKOFF_MAX_INTERVAL);
    console.log('File uploaded');
    await handle.close();
    return response;
}
exports.putSinglePartFile = putSinglePartFile;
async function putPart(url, handle, init) {
    const stream = handle.createReadStream({
        encoding: null,
        autoClose: true,
        start: init.start,
        end: init.end,
    });
    const response = await (0, fetch_with_circuit_breaker_js_1.fetch_with_circuit_breaker)(url, {
        method: 'PUT',
        headers: {
            ...(init.authorization && {
                'Authorization': init.authorization,
            }),
            ...(init.identity && {
                'x-amzn-oidc-identity': init.identity,
            }),
            'If-None-Match': init.ETag,
            'Accept': 'application/json',
            'Content-Type': init.contentType,
            'Content-Length': init.contentLength.toString(),
            'Content-MD5': init.contentMd5,
        },
        mode: 'cors',
        cache: 'no-store',
        body: stream,
        duplex: 'half',
        retryCount: MAX_RETRY_COUNT,
        retryMinDelay: BACKOFF_MIN_INTERVAL,
        retryMaxDelay: BACKOFF_MAX_INTERVAL,
        logBody: init.logBody,
    });
    // HTTP status code 412 Precondition Failed indicates that the resource
    // already exists, and the If-None-Match condition was not met.
    // REF: RFC-7232, Section 6.
    // Note invalid implementations may return 304 Not Modified instead, e.g.
    // MinIO server RELEASE.2023-11-20T22-40-07Z.
    if (response.status === 304
        || response.status === 412) {
        console.log(`Part already uploaded: ${response.status}`);
        return response;
    }
    if (!response.ok) {
        if (response.status >= 500 && response.status < 600) {
            throw new Error(`HTTP status: ${response.status}`);
        }
        return response;
    }
    if (response.body === null) {
        throw new Error('Response body is null');
    }
    if (response.headers.get('ETag') !== init.ETag) {
        throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${init.ETag}`);
    }
    return response;
}
async function getMultiPartFile(url, init) {
    const partCount = Math.ceil(init.contentLength / MAX_UPLOAD_PART_SIZE);
    const parts = new Array(partCount).fill(0).map((_, i) => ([
        i + 1,
        i * MAX_UPLOAD_PART_SIZE,
        Math.min((i + 1) * MAX_UPLOAD_PART_SIZE, init.contentLength) - 1,
    ]));
    const handle = await promises_1.default.open(init.filePath, 'w+');
    try {
        // Enable concurrent writes to different parts of the file.
        console.log(`Creating sparse file with size ${init.contentLength} bytes.`);
        await handle.truncate(init.contentLength);
        const results = await (0, retry_js_1.execute_with_retry)(async (partNumber, start, end) => {
            console.log(`Downloading part ${partNumber} of ${partCount} from ${start} to ${end}.`);
            try {
                const response = await getPart(url, {
                    authorization: init.authorization,
                    identity: init.identity,
                    accept: init.accept,
                    ETag: init.ETag,
                    handle,
                    logBody: init.logBody,
                    start,
                    end,
                });
                console.debug(`Part ${partNumber} status: ${response.status}`);
                return { response, partNumber };
            }
            catch (error) {
                console.error(`Part ${partNumber} error: ${error}`);
                throw error;
            }
        }, parts, MAX_DOWNLOAD_CONCURRENCY, MAX_RETRY_COUNT, BACKOFF_MIN_INTERVAL, BACKOFF_MAX_INTERVAL);
        await handle.close();
        console.log('All parts downloaded');
        return results;
    }
    catch (error) {
        await handle.close();
        console.error(`File download error: ${error}`);
        throw error;
    }
}
exports.getMultiPartFile = getMultiPartFile;
async function getPart(url, init) {
    const response = await (0, fetch_with_circuit_breaker_js_1.fetch_with_circuit_breaker)(url, {
        method: 'GET',
        headers: {
            ...(init.authorization && {
                'Authorization': init.authorization,
            }),
            ...(init.identity && {
                'x-amzn-oidc-identity': init.identity,
            }),
            ...(init.accept && {
                'Accept': init.accept,
            }),
            ...(init.ETag && {
                'If-Match': init.ETag,
            }),
            'Range': `bytes=${init.start}-${init.end}`,
        },
        mode: 'cors',
        cache: 'no-store',
        retryCount: MAX_RETRY_COUNT,
        retryMinDelay: BACKOFF_MIN_INTERVAL,
        retryMaxDelay: BACKOFF_MAX_INTERVAL,
        logBody: init.logBody,
    });
    // HTTP status code 412 Precondition Failed indicates that the resource
    // has changed, and the If-Match condition was not met.
    if (response.status === 412) {
        console.log(`Part has changed: ${response.status}`);
        return response;
    }
    if (!response.ok) {
        if (response.status >= 500 && response.status < 600) {
            throw new Error(`HTTP status: ${response.status}`);
        }
        return response;
    }
    if (response.body === null) {
        throw new Error('Response body is null');
    }
    // ETag mismatch indicates a server failure, as the server should not
    // return a different ETag for the same resource without a 412 status
    // code.
    if (init.ETag
        && response.headers.get('ETag') !== init.ETag) {
        throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${init.ETag}`);
    }
    const stream = init.handle.createWriteStream({
        encoding: null,
        autoClose: false,
        start: init.start,
    });
    const id = setTimeout(() => stream.destroy(), MAX_DOWNLOAD_TIME);
    try {
        await (0, promises_2.finished)(node_stream_1.Readable.fromWeb(response.body).pipe(stream));
        stream.end();
    }
    catch (error) {
        console.error(`Part download error: ${error}`);
        stream.destroy();
        throw error;
    }
    clearTimeout(id);
    // FIXME: Verify MD5 hash of the part?
    return response;
}
//# sourceMappingURL=http-file.js.map