import { NextFunction, Request, Response } from 'express';
export interface ServerTimings {
    start(name: string): void;
    end(name: string): void;
    add(name: string, duration?: number, description?: string): ServerTimings;
}
export declare function serverTimings(): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=server-timings-middleware.d.ts.map