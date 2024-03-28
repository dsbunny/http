# @dsbunny/http
HTTP utility APIs wrapping fetch() with retry and backoff.

## putJson(url: string, json: any): Promise\<Response\>
REF: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT

REF: https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html#API_PutObject_ResponseSyntax

REF: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/412

Circuit breaker wrapper around `fetch()` to perform a `PUT` request with a JSON payload and `Content-MD5` header.  Expects the server to return an `ETag` with a matching MD5 digest of the object.

If the object already exists on the server, the `Response` object will return with `412 Precondition Failed`.

Example usage:
```TypeScript
import { putJson } from '@dsbunny/http';

await putJson('https://example.com/upload', { data: "xyzzy" });
```

## getJson(url: string, init?: { ETag?: string }): Promise\<Response\>
REF: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET

REF: https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html#API_GetObject_ResponseSyntax

REF: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/412

Circuit breaker wrapper around `fetch()` to perform a `GET` request for a JSON payload matching the provided `ETag`.

If the object on the server has changed, the `Response` object will return with `412 Precondition Failed`.

⚠️ Does not verify the MD5 digest of the returned object.

Example usage:
```TypeScript
import { getJson } from '@dsbunny/http';

const response = await getJson('https://example.com/object');
console.log(await response.json());
```

## postJson(url: string, json: any): Promise\<Response\>
REF: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST

Circuit breaker wrapper around `fetch()` to perform a `POST` request with a JSON payload.

⚠️ Does not calculate MD5 digest of the posted object, nor set `If-None-Match` conditional guards.

Example usage:
```TypeScript
import { postJson } from '@dsbunny/http';

const response = await postJson('https://example.com/object', { payload: 123 });
console.log(await response.json());
```

## patchJson(url: string, json: any): Promise\<Response\>
REF: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH

Circuit breaker wrapper around `fetch()` to perform a `PATCH` request with a JSON payload.

⚠️ Does not calculate MD5 digest of the patched object, nor set `If-None-Match` conditional guards.

Example usage:
```TypeScript
import { patchJson } from '@dsbunny/http';

const response = await patchJson('https://example.com/object', { payload: 123 });
console.log(await response.json());
```

## uploadStream(url: string, stream: NodeJS.ReadableStream, init: { contentType: string, contentLength: number, contentMd5: string }): Promise\<Response\>

Circuit breaker wrapper around a streaming `PUT` request, with provided content type, length, and MD5 digest.

Example usage:
```TypeScript
import { uploadStream } from '@dsbunny/http';

const contentLength = (await fs.stat('object.dat')).size;
const contentMD5 = crypto.hash('md5', await fs.readFile('object.dat'), 'base64');
const stream = fs.createReadStream('object.dat', {
	encoding: null,
	autoClose: true,
});
const web_stream = Readable.toWeb(stream);
await uploadStream('https://example.com/stream', web_stream, {
	contentType: 'application/octet-stream',
	contentLength,
	contentMD5,
});
```

## download(url: string, init: { accept: string }): Promise\<Response\>

Circuit breaker wrapper around a streaming `GET` request.

Example usage:
```TypeScript
import { download } from '@dsbunny/http';

const response = download('https://example.com/stream', {
	accept: 'application/octet-stream',
})
const stream = fs.createWriteStream('object.dat', {
	encoding: null,
	autoClose: true,
});
await finished(Readable.fromWeb(response.body as any).pipe(stream));
```

## putMultiPartFile(parts: MultiPartRequest[], filePath: string, init: { contentType: string, contentLength: number, contentMd5: string }): Promise\<MultiPartResponse[]\>

Circuit breaker wrapper around a multipart `PUT` request.

⚠️ Requires server side support in processing each part in a well defined protocol.

Example usage:
```TypeScript
import { putMultiPartFile } from '@dsbunny/http';

const contentLength = (await fs.stat('object.dat')).size;
const parts = [
	{
		partNumber: 1,
		url: 'https://example.com/object?partNumber=1',
		start: 0,
		end: 5242880 - 1,
		contentLength: 5242880,
		contentMD5: crypto.hash('md5',
			(await fs.readFile('object.dat')).slice(0, 5242880 - 1),
			'base64',
		),
	},
	{
		partNumber: 2,
		url: 'https://example.com/object?partNumber=2',
		start: 5242880,
		end: contentLength - 1,
		contentLength: contentLength - 5242880,
		contentMD5: crypto.hash('md5',
			(await fs.readFile('object.dat')).slice(5242880),
			'base64',
		),
	}
];
await putMultiPartFile(parts, 'object.dat', {
	contentType: 'application/octet-stream',
	contentLength,
	contentMD5,
}
```
## getMultiPartFile(url: string, init: { filePath: string, contentLength: number }): Promise\<MultiPartResponse[]\>

REF: https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests

Circuit breaker wrapper around a multipart `GET` request.

⚠️ Requires server side support of `Range` requests.

Example usage:
```TypeScript
import { getMultiPartFile } from '@dsbunny/http';

await getMultiPartFile('https://example.com/object', {
	filePath: 'object.dat',
	contentLength: 131072,
});
```
