export declare function putJson(url: string, json: any, init?: {
    authorization?: string;
    identity?: string;
    logBody?: boolean;
}): Promise<{
    response: Response;
    contentLength: number;
    contentMd5: string;
}>;
export declare function getJson(url: string, init?: {
    authorization?: string;
    identity?: string;
    ETag?: string;
    logBody?: boolean;
}): Promise<Response>;
export declare function postJson(url: string, json: any, init?: {
    authorization?: string;
    identity?: string;
    logBody?: boolean;
}): Promise<{
    response: Response;
    contentLength: number;
}>;
export declare function patchJson(url: string, json: any, init?: {
    authorization?: string;
    identity?: string;
    logBody?: boolean;
}): Promise<{
    response: Response;
    contentLength: number;
}>;
//# sourceMappingURL=http-json.d.ts.map