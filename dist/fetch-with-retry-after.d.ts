export declare function fetch_with_log(url: string | URL | globalThis.Request, init?: RequestInit & {
    logBody?: boolean;
}): Promise<Response>;
export declare function fetch_with_retry_after(url: string, init?: RequestInit & {
    timeout?: number;
    retryCount?: number;
    retryMinDelay?: number;
    retryMaxDelay?: number;
    attempt?: number;
    logBody?: boolean;
}): Promise<Response>;
//# sourceMappingURL=fetch-with-retry-after.d.ts.map