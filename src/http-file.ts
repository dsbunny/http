// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
// REF: https://docs.aws.amazon.com/AmazonS3/latest/userguide/example_s3_Scenario_UsingLargeFiles_section.html
// REF: https://docs.aws.amazon.com/whitepapers/latest/s3-optimizing-performance-best-practices/use-byte-range-fetches.html

import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { fetch_with_circuit_breaker } from './fetch-with-circuit-breaker.js';
import { execute_with_retry, retry } from './retry.js';

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

interface MultiPartRequest {
	partNumber: number;
	url: string;
	start: number;
	end: number;
	contentLength: number;
	contentMd5: string;
};

interface MultiPartResponse {
	partNumber: number;
	response: Response;
};

export async function putMultiPartFile(
	parts: MultiPartRequest[],
	filePath: string,
	init: {
		authorization?: string,
		identity?: string,
		contentType: string,
		contentLength: number,
		contentMd5: string,
		logBody?: boolean,
	}
): Promise<MultiPartResponse[]> {
	const partCount = parts.length;
	const parameters = parts.map((part) => ([
		part.url,
		part.partNumber,
		part.start,
		part.end,
		part.contentLength,
		part.contentMd5,
	]) as [string, number, number, number, number, string]);

	const handle = await fs.open(filePath, 'r');

	const results = await execute_with_retry<[string, number, number, number, number, string], MultiPartResponse>(
		async (url: string, partNumber: number, start: number, end: number, contentLength: number, contentMd5: string) => {
			console.log(`Uploading part ${partNumber} of ${partCount} from ${start} to ${end}`);
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
		},
		parameters,
		MAX_UPLOAD_CONCURRENCY,
		MAX_RETRY_COUNT,
		BACKOFF_MIN_INTERVAL,
		BACKOFF_MAX_INTERVAL,
	);

	console.log('All parts uploaded');
	await handle.close();

	return results;
}

export async function putSinglePartFile(
	url: string,
	filePath: string,
	init: {
		authorization?: string,
		identity?: string,
		contentType: string,
		contentLength: number,
		contentMd5: string,
		logBody?: boolean,
	}
): Promise<Response> {
	const handle = await fs.open(filePath, 'r');
	let response = await retry<Response>(
		() => {
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
		},
		MAX_RETRY_COUNT,
		BACKOFF_MIN_INTERVAL,
		BACKOFF_MAX_INTERVAL,
	);

	console.log('File uploaded');
	await handle.close();
	return response;
}

async function putPart(
	url: string,
	handle: fs.FileHandle,
	init: {
		authorization?: string,
		identity?: string,
		ETag: string,  // ETag of the uploaded part
		contentType: string,
		contentLength: number,
		contentMd5: string,
		logBody?: boolean,
		start: number,
		end: number,
	},
): Promise<Response> {
	const stream = handle.createReadStream({
		encoding: null,
		autoClose: true,
		start: init.start,
		end: init.end,
	});
	const response = await fetch_with_circuit_breaker(url, {
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
		body: stream as any,
		duplex: 'half',
		retryCount: MAX_RETRY_COUNT,
		retryMinDelay: BACKOFF_MIN_INTERVAL,
		retryMaxDelay: BACKOFF_MAX_INTERVAL,
		logBody: init.logBody,
	} as RequestInit);
	// HTTP status code 412 Precondition Failed indicates that the resource
	// already exists, and the If-None-Match condition was not met.
	// REF: RFC-7232, Section 6.
	// Note invalid implementations may return 304 Not Modified instead, e.g.
	// MinIO server RELEASE.2023-11-20T22-40-07Z.
	if(response.status === 304
		|| response.status === 412)
	{
		console.log(`Part already uploaded: ${response.status}`);
		return response;
	}
	if(!response.ok) {
		throw new Error(`HTTP status: ${response.status}`);
	}
	if(response.body === null) {
		throw new Error('Response body is null');
	}
	if(response.headers.get('ETag') !== init.ETag) {
		throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${init.ETag}`);
	}
	return response;
}

export async function getMultiPartFile(
	url: string,
	init: {
		authorization?: string,
		identity?: string,
		accept?: string,
		ETag?: string,
		filePath: string,
		contentLength: number,
		logBody?: boolean,
	},
): Promise<MultiPartResponse[]> {
	const partCount = Math.ceil(init.contentLength / MAX_UPLOAD_PART_SIZE);
	const parts = new Array(partCount).fill(0).map((_, i) => ([
		i + 1,
		i * MAX_UPLOAD_PART_SIZE,
		Math.min((i + 1) * MAX_UPLOAD_PART_SIZE, init.contentLength) - 1,
	]) as [number, number, number]);

	const handle = await fs.open(init.filePath, 'w+');

	const results = await execute_with_retry<[number, number, number], MultiPartResponse>(
		async (partNumber: number, start: number, end: number) => {
			console.log(`Downloading part ${partNumber} of ${partCount} from ${start} to ${end}`);
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
			return { response, partNumber };
		},
		parts,
		MAX_DOWNLOAD_CONCURRENCY,
		MAX_RETRY_COUNT,
		BACKOFF_MIN_INTERVAL,
		BACKOFF_MAX_INTERVAL,
	);

	console.log('All parts downloaded');
	await handle.close()

	return results;
}

async function getPart(
	url: string,
	init: {
		authorization?: string,
		identity?: string,
		accept?: string,
		ETag?: string,  // ETag of the entire file
		handle: fs.FileHandle,
		logBody?: boolean,
		start: number,
		end: number,
	},
): Promise<Response> {
	const response = await fetch_with_circuit_breaker(url, {
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
	if(response.status === 412) {
		console.log(`Part has changed: ${response.status}`);
		return response;
	}
	if(!response.ok) {
		throw new Error(`HTTP status: ${response.status}`);
	}
	if(response.body === null) {
		throw new Error('Response body is null');
	}
	// ETag mismatch indicates a server failure, as the server should not
	// return a different ETag for the same resource without a 412 status
	// code.
	if(init.ETag
		&& response.headers.get('ETag') !== init.ETag)
	{
		throw new Error(`ETag mismatch: ${response.headers.get('ETag')} !== ${init.ETag}`);
	}
	const stream = init.handle.createWriteStream({
		encoding: null,
		autoClose: true,
		start: init.start,
	});
	const id = setTimeout(() => stream.destroy(), MAX_DOWNLOAD_TIME);
	await finished(Readable.fromWeb(response.body as any).pipe(stream));
	clearTimeout(id);
	// FIXME: Verify MD5 hash of the part?
	return response;
}
