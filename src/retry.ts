// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
// REF: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

import { styleText } from 'node:util';

export function wait(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function random_between(
	min: number,
	max: number
): number {
	return Math.random() * (max - min) + min;
}

export function exponential_backoff_with_jitter(
	base: number,
	cap: number,
	attempt: number
): number {
	const temp = Math.min(cap, base * 2 ** attempt);
	const sleep_ms = temp / 2 + random_between(0, temp / 2);
	return Math.min(cap, random_between(base, sleep_ms * 3));
}

export async function retry<T = any>(
	fn: () => Promise<T>,
	retryCount: number,
	minDelay: number,
	maxDelay: number,
	attempt: number = 1
): Promise<T> {
	try {
		return await fn();
	} catch(error: unknown) {
		if(retryCount > 0) {
			const sleep_ms = exponential_backoff_with_jitter(minDelay, maxDelay, attempt);
			console.warn(styleText('yellow',
				`[retry] Retry attempt ${attempt} after ${Math.floor(sleep_ms)}ms`,
			));
			await wait(sleep_ms);
			return retry<T>(fn, retryCount - 1, minDelay, maxDelay, attempt + 1);
		}
		console.warn(styleText('red',
			'[retry] Retry failed.',
		));
		throw error;
	}
}

export async function execute_with_retry<T extends unknown[], D = any>(
	func: (...args: T) => Promise<D>,
	paramSets: T[],
	maxConcurrency: number,
	retryCount: number,
	retryMinDelay: number,
	retryMaxDelay: number
): Promise<D[]> {
	const results: D[] = [];

	async function executeOne(params: T): Promise<void> {
		const result = await retry(
			() => func(...params),
			retryCount,
			retryMinDelay,
			retryMaxDelay,
		);
		results.push(result);
	}

	const promises: Promise<void>[] = [];

	for(const paramSet of paramSets) {
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
