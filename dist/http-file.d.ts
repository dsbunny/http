interface MultiPartRequest {
    partNumber: number;
    url: string;
    start: number;
    end: number;
    contentLength: number;
    contentMd5: string;
}
interface MultiPartResponse {
    partNumber: number;
    response: Response;
}
export declare function putMultiPartFile(parts: MultiPartRequest[], filePath: string, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    contentMd5: string;
    logBody?: boolean;
}): Promise<MultiPartResponse[]>;
export declare function putSinglePartFile(url: string, filePath: string, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    contentMd5: string;
    logBody?: boolean;
}): Promise<Response>;
export declare function getMultiPartFile(url: string, init: {
    authorization?: string;
    identity?: string;
    accept?: string;
    ETag?: string;
    filePath: string;
    contentLength: number;
    logBody?: boolean;
}): Promise<MultiPartResponse[]>;
export {};
//# sourceMappingURL=http-file.d.ts.map