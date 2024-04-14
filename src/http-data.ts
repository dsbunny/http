// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab

import { BinaryLike } from 'node:crypto';
import { fetch_with_circuit_breaker } from './fetch-with-circuit-breaker.js';
import { retry } from './retry.js';

const MAX_RETRY_COUNT = 3;
const BACKOFF_MIN_INTERVAL = 15 * 1000;
const BACKOFF_MAX_INTERVAL = 300 * 1000;

export async function putData(
	url: string,
	data: BinaryLike,
	init: {
		authorization?: string,
		identity?: string,
		contentType: string,
		contentLength: number,
		contentMd5: string,
		logBody?: boolean,
	}
): Promise<Response> {
	const response = await retry<Response>(
		() => putDataOnce(url, data, init),
		MAX_RETRY_COUNT,
		BACKOFF_MIN_INTERVAL,
		BACKOFF_MAX_INTERVAL,
	);

	return response;
}

export async function putDataOnce(
	url: string,
	data: BinaryLike,
	init: {
		authorization?: string,
		identity?: string,
		contentType: string,
		contentLength: number,
		contentMd5: string,
		logBody?: boolean,
	}
): Promise<Response> {
	const ETag = `"${Buffer.from(init.contentMd5, 'base64').toString('hex')}"`;
	const response = await fetch_with_circuit_breaker(url, {
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
		logBody: init.logBody,
	});
	// HTTP status code 412 Precondition Failed indicates that the resource
	// already exists, and the If-None-Match condition was not met.
	if(!response.ok) {
		if(response.status >= 500 && response.status < 600) {
			throw new Error(`HTTP status: ${response.status}`);
		}
		return response;
	}
	if(response.body === null) {
		throw new Error('Response body is null');
	}
	// REF: https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html#API_PutObject_ResponseSyntax
	//
	// "To ensure that data is not corrupted traversing the network, for
	// objects where the ETag is the MD5 digest of the object, you can
	// calculate the MD5 while putting an object to Amazon S3 and compare
	// the returned ETag to the calculated MD5 value."
	if(response.headers.get('ETag') !== ETag) {
		throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${ETag}`);
	}
	return response;
}

export async function getData(
	url: string,
	init: {
		authorization?: string,
		identity?: string,
		accept: string,
		ETag?: string,
		logBody?: boolean,
	}
): Promise<Response> {
	const response = await retry<Response>(
		() => getDataOnce(url, init),
		MAX_RETRY_COUNT,
		BACKOFF_MIN_INTERVAL,
		BACKOFF_MAX_INTERVAL,
	);

	return response;
}

export async function getDataOnce(
	url: string,
	init: {
		authorization?: string,
		identity?: string,
		accept: string,
		ETag?: string,
		logBody?: boolean,
	}
): Promise<Response> {
	const response = await fetch_with_circuit_breaker(url, {
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
		logBody: init.logBody,
	});
	if(!response.ok) {
		if(response.status >= 500 && response.status < 600) {
			throw new Error(`HTTP status: ${response.status}`);
		}
		return response;
	}
	if(init.ETag
		&& response.headers.get('ETag') !== init.ETag)
	{
		throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${init.ETag}`);
	}
	return response;
}

// Special case for POST requests.
export async function postData(
	url: string,
	data: BinaryLike,
	init: {
		authorization?: string,
		identity?: string,
		contentType: string,
		contentLength: number,
		logBody?: boolean,
	}
): Promise<Response> {
	const response = await retry<Response>(
		() => postDataOnce(url, data, init),
		MAX_RETRY_COUNT,
		BACKOFF_MIN_INTERVAL,
		BACKOFF_MAX_INTERVAL,
	);

	return response;
}

export async function postDataOnce(
	url: string,
	data: BinaryLike,
	init: {
		authorization?: string,
		identity?: string,
		contentType: string,
		contentLength: number,
		logBody?: boolean,
	}
): Promise<Response> {
	const response = await fetch_with_circuit_breaker(url, {
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
		logBody: init.logBody,
	});
	// HTTP status code 412 Precondition Failed indicates that the resource
	// already exists, and the If-None-Match condition was not met.
	if(!response.ok) {
		if(response.status >= 500 && response.status < 600) {
			throw new Error(`HTTP status: ${response.status}`);
		}
		return response;
	}
	if(response.body === null) {
		throw new Error('Response body is null');
	}
	return response;
}

// Special case for PATCH requests.
export async function patchData(
	url: string,
	data: BinaryLike,
	init: {
		authorization?: string,
		identity?: string,
		contentType: string,
		contentLength: number,
		logBody?: boolean,
	}
): Promise<Response> {
	const response = await retry<Response>(
		() => patchDataOnce(url, data, init),
		MAX_RETRY_COUNT,
		BACKOFF_MIN_INTERVAL,
		BACKOFF_MAX_INTERVAL,
	);

	return response;
}

export async function patchDataOnce(
	url: string,
	data: BinaryLike,
	init: {
		authorization?: string,
		identity?: string,
		contentType: string,
		contentLength: number,
		logBody?: boolean,
	}
): Promise<Response> {
	const response = await fetch_with_circuit_breaker(url, {
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
		logBody: init.logBody,
	});
	// HTTP status code 412 Precondition Failed indicates that the resource
	// already exists, and the If-None-Match condition was not met.
	if(!response.ok) {
		if(response.status >= 500 && response.status < 600) {
			throw new Error(`HTTP status: ${response.status}`);
		}
		return response;
	}
	if(response.body === null) {
		throw new Error('Response body is null');
	}
	return response;
}
