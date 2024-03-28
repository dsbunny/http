export declare function wait(ms: number): Promise<void>;
export declare function random_between(min: number, max: number): number;
export declare function exponential_backoff_with_jitter(base: number, cap: number, attempt: number): number;
export declare function retry<T = any>(fn: () => Promise<T>, retryCount: number, minDelay: number, maxDelay: number, attempt?: number): Promise<T>;
export declare function execute_with_retry<T extends unknown[], D = any>(func: (...args: T) => Promise<D>, paramSets: T[], maxConcurrency: number, retryCount: number, retryMinDelay: number, retryMaxDelay: number): Promise<D[]>;
//# sourceMappingURL=retry.d.ts.map