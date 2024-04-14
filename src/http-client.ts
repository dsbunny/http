// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab

import { fetch_with_retry_after } from './fetch-with-retry-after.js';

const MAX_DOWNLOAD_TIME = 60 * 1000;
const MAX_UPLOAD_TIME = 60 * 1000;
const MAX_RETRY_COUNT = 3;
const BACKOFF_MIN_INTERVAL = 15 * 1000;
const BACKOFF_MAX_INTERVAL = 300 * 1000;

export async function uploadStream(
	url: string,
	stream: NodeJS.ReadableStream,
	init: { authorization?: string, identity?: string, contentType: string, contentLength: number, contentMd5: string }
): Promise<Response> {
	const ETag = `"${Buffer.from(init.contentMd5, 'base64').toString('hex')}"`;
	const response = await fetch_with_retry_after(url, {
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
		cache: 'no-cache',
		body: stream as any,
		// REF: https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests
		duplex: 'half',
		timeout: MAX_UPLOAD_TIME,
		retryCount: MAX_RETRY_COUNT,
		retryMinDelay: BACKOFF_MIN_INTERVAL,
		retryMaxDelay: BACKOFF_MAX_INTERVAL,
	} as RequestInit);
	// HTTP status code 412 Precondition Failed indicates that the resource
	// already exists, and the If-None-Match condition was not met.
	if(!response.ok) {
		if(response.status >= 500 && response.status < 600) {
			throw new Error(`HTTP status: ${response.status}`);
		}
		return response;
	}
	if(response.headers.get('ETag') !== ETag) {
		throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${ETag}`);
	}
	return response;
}

// Same API for streaming & non-streaming as it only acquires the headers.
// FIXME: Implement integrity parameter, if we can acquire SHA-256 hash on client.
export async function download(
	url: string,
	init: { authorization?: string, identity?: string, accept: string, ETag?: string }
): Promise<Response> {
	const response = await fetch_with_retry_after(url, {
		headers: {
			...(init?.authorization && {
				'Authorization': init.authorization,
			}),
			...(init?.identity && {
				'x-amzn-oidc-identity': init.identity,
			}),
			...(init.ETag && {
				'If-Match': init.ETag,
			}),
			'Accept': init.accept,
		},
		mode: 'cors',
		cache: 'no-cache',
		timeout: MAX_DOWNLOAD_TIME,
		retryCount: MAX_RETRY_COUNT,
		retryMinDelay: BACKOFF_MIN_INTERVAL,
		retryMaxDelay: BACKOFF_MAX_INTERVAL,
	});
	if(!response.ok) {
		if(response.status >= 500 && response.status < 600) {
			throw new Error(`HTTP status: ${response.status}`);
		}
		return response;
	}
	return response;
}
