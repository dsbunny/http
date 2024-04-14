// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab

import { createHash } from 'node:crypto';
import { putData, getData, postData, patchData } from './http-data.js';

export async function putJson(
	url: string,
	json: any,
	init?: {
		authorization?: string,
		identity?: string,
		logBody?: boolean,
	}
): Promise<{
	response: Response,
	contentLength: number,
	contentMd5: string,
}> {
	const text = JSON.stringify(json);
	const contentMd5 = createHash('md5').update(text).digest().toString('base64');

	const response = await putData(url, text, {
		authorization: init?.authorization,
		identity: init?.identity,
		contentType: 'application/json',
		contentLength: text.length,
		contentMd5,
		logBody: init?.logBody,
	});
	return {
		response,
		contentLength: text.length,
		contentMd5,
	};
}

export async function getJson(
	url: string,
	init?: {
		authorization?: string,
		identity?: string,
		ETag?: string,
		logBody?: boolean,
	}
): Promise<Response> {
	const response = await getData(url, {
		authorization: init?.authorization,
		identity: init?.identity,
		accept: 'application/json',
		ETag: init?.ETag,
		logBody: init?.logBody,
	});
	return response;
}

// Special case for POST requests with JSON body, without MD5 checksum, nor
// content guards.
export async function postJson(
	url: string,
	json: any,
	init?: {
		authorization?: string,
		identity?: string,
		logBody?: boolean,
	}
): Promise<{
	response: Response,
	contentLength: number,
}> {
	const text = JSON.stringify(json);

	const response = await postData(url, text, {
		authorization: init?.authorization,
		identity: init?.identity,
		contentType: 'application/json',
		contentLength: text.length,
		logBody: init?.logBody,
	});
	return {
		response,
		contentLength: text.length,
	};
}

// Similarly for the HTTP PATCH verb.
export async function patchJson(
	url: string,
	json: any,
	init?: {
		authorization?: string,
		identity?: string,
		logBody?: boolean,
	}
): Promise<{
	response: Response,
	contentLength: number,
}> {
	const text = JSON.stringify(json);

	const response = await patchData(url, text, {
		authorization: init?.authorization,
		identity: init?.identity,
		contentType: 'application/json',
		contentLength: text.length,
		logBody: init?.logBody,
	});
	return {
		response,
		contentLength: text.length,
	};
}
