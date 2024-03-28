/// <reference types="node" />
import { BinaryLike } from 'node:crypto';
export declare function putData(url: string, data: BinaryLike, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    contentMd5: string;
    logBody?: boolean;
}): Promise<Response>;
export declare function putDataOnce(url: string, data: BinaryLike, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    contentMd5: string;
    logBody?: boolean;
}): Promise<Response>;
export declare function getData(url: string, init: {
    authorization?: string;
    identity?: string;
    accept: string;
    ETag?: string;
    logBody?: boolean;
}): Promise<Response>;
export declare function getDataOnce(url: string, init: {
    authorization?: string;
    identity?: string;
    accept: string;
    ETag?: string;
    logBody?: boolean;
}): Promise<Response>;
export declare function postData(url: string, data: BinaryLike, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    logBody?: boolean;
}): Promise<Response>;
export declare function postDataOnce(url: string, data: BinaryLike, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    logBody?: boolean;
}): Promise<Response>;
export declare function patchData(url: string, data: BinaryLike, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    logBody?: boolean;
}): Promise<Response>;
export declare function patchDataOnce(url: string, data: BinaryLike, init: {
    authorization?: string;
    identity?: string;
    contentType: string;
    contentLength: number;
    logBody?: boolean;
}): Promise<Response>;
//# sourceMappingURL=http-data.d.ts.map