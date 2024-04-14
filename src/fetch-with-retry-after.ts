// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab

import { Readable } from 'node:stream';
// @ts-expect-error
import { styleText } from 'node:util';
import {
	wait,
	random_between,
	exponential_backoff_with_jitter,
} from './retry.js';

function style_for_status(status: number) {
	if(status >= 200 && status < 300) {
		return 'green';
	} else if(status >= 300 && status < 400) {
		return 'yellow';
	} else if(status >= 400 && status < 600) {
		return 'red';
	} else {
		return 'grey';
	}
}

export async function fetch_with_log(
	url: string | URL | globalThis.Request,
	init?: RequestInit & {
		logBody?: boolean,
	}
): Promise<Response> {
	const request_headers = Array.from(new Headers(init?.headers ?? {}).entries());
	console.log(styleText('cyan', `${init?.method ?? 'GET'} ${url}`));
	console.log(request_headers.map(([key, value]) => `${key}: ${value}`).join('\n'));
	const body = init?.body;
	if(typeof body === 'string') {
		body.split('\n').forEach((line) => {
			console.log(styleText('grey', line));
		});
	}
	const response = await fetch(url, init);
	// Serialize the headers to a string
	const response_headers = Array.from(response.headers.entries())
	if((response.status >= 400 && response.status < 600)
		|| (init && 'logBody' in init && init.logBody))
	{
		const text = await response.clone().text();
		console.log(styleText(style_for_status(response.status), `HTTP ${response.status} ${response.statusText}`));
		console.log(response_headers.map(([key, value]) => `${key}: ${value}`).join('\n'));
		// Docker logs will reset style after each line.
		// So we need to split the text into lines and style each line.
		text.split('\n').forEach((line) => {
			console.log(styleText('grey', line));
		});
	} else {
		console.log(styleText(style_for_status(response.status), `HTTP ${response.status} ${response.statusText}`));
		console.log(response_headers.map(([key, value]) => `${key}: ${value}`).join('\n'));
	}
	return response;
}

async function fetch_with_timeout(
	url: string,
	init?: RequestInit & {
		timeout: number,
		logBody?: boolean,
	}
): Promise<Response> {
	if(init?.timeout) {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), init.timeout);
		try {
			return await fetch_with_log(url, { ...init, signal: controller.signal });
		} finally {
			clearTimeout(id);
		}
	} else {
		return await fetch_with_log(url, init);
	}
}

export async function fetch_with_retry_after(
	url: string,
	init?: RequestInit & {
		timeout?: number,
		retryCount?: number,
		retryMinDelay?: number,
		retryMaxDelay?: number,
		attempt?: number,
		logBody?: boolean,
	}
): Promise<Response> {
	const timeout = init?.timeout || 0;
	const retryCount = init?.retryCount || 0;
	const retryMinDelay = init?.retryMinDelay || 0;
	const retryMaxDelay = init?.retryMaxDelay || 0;
	const attempt = init?.attempt || 1;
	if(retryCount && (!retryMinDelay || !retryMaxDelay)) {
		throw new Error('retryMinDelay and retryMaxDelay are required when retryCount is set.');
	}
	try {
		const response = await fetch_with_timeout(url, {
			...init,
			timeout,
		});
		if(retryCount > 0
			&& response.status >= 500 && response.status < 600)
		{
			let sleep_ms = 0;
			const retry_after = response.headers.get('Retry-After');
			if(retry_after) {
				let base = 0;
				let date = Date.parse(retry_after);
				if(isNaN(date)) {
					const delay_seconds = parseInt(retry_after);
					if(delay_seconds) {
						base = delay_seconds * 1000;
					}
				} else {
					base = date - Date.now();
				}
				// Force the base to be within the range of the min and max delay.
				base = Math.max(retryMinDelay, Math.min(retryMaxDelay, base));
				const cap = retryMaxDelay;

				// Exponential backoff with jitter.
				const temp = Math.min(cap, base * 2 ** attempt);
				sleep_ms = temp / 2 + random_between(0, temp / 2);
				sleep_ms = Math.min(cap, random_between(base, sleep_ms * 3));
			} else {
				sleep_ms = exponential_backoff_with_jitter(retryMinDelay, retryMaxDelay, attempt);
			}
			console.warn(styleText('yellow',
				`[retry] Retry attempt ${attempt} after ${Math.floor(sleep_ms)}ms`,
			));
			await wait(sleep_ms);
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
	} catch(error: unknown) {
                if(retryCount > 0) {
                        const sleep_ms = exponential_backoff_with_jitter(retryMinDelay, retryMaxDelay, attempt);
                        console.warn(styleText('yellow',
				`[retry] Retry attempt ${attempt} after ${Math.floor(sleep_ms)}ms`,
			));
                        await wait(sleep_ms);
			return fetch_with_retry_after(url, {
				...init,
				timeout,
				retryCount: retryCount - 1,
				retryMinDelay,
				retryMaxDelay,
				attempt: attempt + 1,
			});
                }
                console.warn(styleText('red',
			'[retry] Retry failed.',
		));
                throw error;
        }
}
