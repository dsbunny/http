// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab

import { styleText } from 'node:util';
import CircuitBreaker from 'opossum';
import { fetch_with_log } from "./fetch-with-retry-after.js";
import {
	wait,
	random_between,
	exponential_backoff_with_jitter,
} from './retry.js';

// Default settings per OCI-TypeScript-SDK:
// https://github.com/oracle/oci-typescript-sdk/blob/master/lib/common/lib/circuit-breaker.ts
const circuitBreakerOptions = {
        timeout: 60000, // If our function takes longer than 60 seconds, trigger a failure
        errorThresholdPercentage: 80, // When 80% of requests fail, trip the circuit
        resetTimeout: 30000, // After 30 seconds, try again.
        rollingCountTimeout: 120000,
        rollingCountBuckets: 120,
        volumeThreshold: 10,
        abortController: (() => {
                let controller = new AbortController();
                return {
                        abort: () => {
                                controller.abort();
                                controller = new AbortController();
                        },
                        get signal() {
                                return controller.signal;
                        }
                };
        })(),
};
export const fetchBreaker = new CircuitBreaker(fetch_with_log, circuitBreakerOptions);

for(const circuitBreaker of [fetchBreaker]) {
	circuitBreaker.on("open", () => {
		console.log(`${circuitBreaker.name}: circuit breaker is now in OPEN state`);
	});
	circuitBreaker.on("halfOpen", () => {
		console.log(`${circuitBreaker.name}: circuit breaker is now in HALF OPEN state`);
	});
	circuitBreaker.on("close", () => {
		console.log(`${circuitBreaker.name}: circuit breaker is now in CLOSE state`);
	});
	circuitBreaker.on("shutdown", () => {
		console.log(`${circuitBreaker.name}: circuit breaker is now SHUTDOWN`);
	});
};

export async function fetch_with_circuit_breaker(
	url: string,
	init?: RequestInit & {
		retryCount?: number,
		retryMinDelay?: number,
		retryMaxDelay?: number,
		attempt?: number,
		logBody?: boolean,
	}
): Promise<Response> {
	const retryCount = init?.retryCount || 0;
	const retryMinDelay = init?.retryMinDelay || 0;
	const retryMaxDelay = init?.retryMaxDelay || 0;
	const attempt = init?.attempt || 1;
	if(retryCount && (!retryMinDelay || !retryMaxDelay)) {
		throw new Error('retryMinDelay and retryMaxDelay are required when retryCount is set.');
	}
	try {
		const response = await fetchBreaker.fire(url, {
			...init,
			signal: circuitBreakerOptions.abortController.signal,
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
			return fetch_with_circuit_breaker(url, {
				...init,
				retryCount: retryCount - 1,
				retryMinDelay,
				retryMaxDelay,
				attempt: attempt + 1,
			});
		}
		return response;
	} catch(error: unknown) {
		if(fetchBreaker.opened) {
			console.warn(styleText('red',
				'[retry] Circuit breaker is OPEN.',
			));
			throw error;
		}
                if(retryCount > 0) {
                        const sleep_ms = exponential_backoff_with_jitter(retryMinDelay, retryMaxDelay, attempt);
                        console.warn(styleText('yellow',
				`[retry] Retry attempt ${attempt} after ${Math.floor(sleep_ms)}ms`,
			));
                        await wait(sleep_ms);
			return fetch_with_circuit_breaker(url, {
				...init,
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
