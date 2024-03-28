"use strict";
// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchJson = exports.postJson = exports.getJson = exports.putJson = void 0;
const node_crypto_1 = require("node:crypto");
const http_data_js_1 = require("./http-data.js");
async function putJson(url, json, init) {
    const text = JSON.stringify(json);
    const contentMd5 = (0, node_crypto_1.createHash)('md5').update(text).digest().toString('base64');
    const response = await (0, http_data_js_1.putData)(url, text, {
        authorization: init?.authorization,
        identity: init?.identity,
        contentType: 'application/json',
        contentLength: text.length,
        contentMd5,
        logBody: init?.logBody,
    });
    return response;
}
exports.putJson = putJson;
async function getJson(url, init) {
    const response = await (0, http_data_js_1.getData)(url, {
        authorization: init?.authorization,
        identity: init?.identity,
        accept: 'application/json',
        ETag: init?.ETag,
        logBody: init?.logBody,
    });
    return response;
}
exports.getJson = getJson;
// Special case for POST requests with JSON body, without MD5 checksum, nor
// content guards.
async function postJson(url, json, init) {
    const text = JSON.stringify(json);
    const response = await (0, http_data_js_1.postData)(url, text, {
        authorization: init?.authorization,
        identity: init?.identity,
        contentType: 'application/json',
        contentLength: text.length,
        logBody: init?.logBody,
    });
    return response;
}
exports.postJson = postJson;
// Similarly for the HTTP PATCH verb.
async function patchJson(url, json, init) {
    const text = JSON.stringify(json);
    const response = await (0, http_data_js_1.patchData)(url, text, {
        authorization: init?.authorization,
        identity: init?.identity,
        contentType: 'application/json',
        contentLength: text.length,
        logBody: init?.logBody,
    });
    return response;
}
exports.patchJson = patchJson;
//# sourceMappingURL=http-json.js.map