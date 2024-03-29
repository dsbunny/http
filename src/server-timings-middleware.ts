// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
// Automatically generate HTTP "Server-Timing" headers for each request.

import { NextFunction, Request, Response } from 'express';
import onHeaders from 'on-headers';

export interface ServerTimings {
	start(name: string): void;
	end(name: string): void;
	add(name: string, duration?: number, description?: string): ServerTimings;
};

// API assumes that upon setting of response headers, processing is complete.
// Using HTTP trailers would be more appropriate, but they required chunked
// encoding, and may not be supported by the client.
export function serverTimings() {
	return (req: Request, res: Response, next: NextFunction) => {
		const start = process.hrtime.bigint();
		const timings = new Map<string, bigint>();
		const endedTimings: [string, number?, string?][] = [];
		res.locals.timings = {
			start(name: string) {
				timings.set(name, process.hrtime.bigint());
			},
			end(name: string) {
				const start = timings.get(name);
				if(typeof start === "undefined") {
					throw new Error(`No start time for "${name}"`);
				}
				const end = process.hrtime.bigint();
				const duration = Number(end - start) / 1e6;
				const rounded = Math.round(duration * 100 + Number.EPSILON) / 100;
				endedTimings.push([name, rounded]);
			},
			add(name: string, duration?: number, description?: string) {
				endedTimings.push([
					name,
					typeof duration !== "undefined"
						? Math.round(duration * 100 + Number.EPSILON) / 100
						: undefined,
					description,
				]);
				return this;
			},
		} as ServerTimings;
		onHeaders(res, () => {
			const values: string[] = [];
			for(const [name, duration, description] of endedTimings) {
				const metrics = [name];
				if(typeof duration !== "undefined") {
					metrics.push(`dur=${duration}`);
				}
				if(typeof description !== "undefined") {
					metrics.push(`desc="${description}"`);
				}
				values.push(metrics.join(";"));
			}
			if(values.length > 0) {
				res.append("Server-Timing", values.join(", "));
			}
			const end = process.hrtime.bigint();
			const duration = Number(end - start) / 1e6;
			const rounded = Math.round(duration * 100 + Number.EPSILON) / 100;
			res.append("Server-Timing", `total;dur=${rounded}`);
		});
		next();
	};
}
