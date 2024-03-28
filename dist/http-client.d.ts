/// <reference types="node" />
export declare function uploadStream(url: string, stream: NodeJS.ReadableStream, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    contentMd5: string;
}): Promise<Response>;
export declare function download(url: string, init: {
    authorization?: string;
    identity?: string;
    accept: string;
    ETag?: string;
}): Promise<Response>;
//# sourceMappingURL=http-client.d.ts.map