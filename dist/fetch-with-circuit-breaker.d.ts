import CircuitBreaker from 'opossum';
export declare const fetchBreaker: CircuitBreaker<[url: string | URL | Request, init?: (RequestInit & {
    logBody?: boolean | undefined;
}) | undefined], Response>;
export declare function fetch_with_circuit_breaker(url: string, init?: RequestInit & {
    retryCount?: number;
    retryMinDelay?: number;
    retryMaxDelay?: number;
    attempt?: number;
    logBody?: boolean;
}): Promise<Response>;
//# sourceMappingURL=fetch-with-circuit-breaker.d.ts.map