import type { ConnectionMode } from '../types.js';

export interface BaseProtocolBuilder {
	buffer: Buffer;
	bmRequestType: number;
	bRequest: number;
	wValue: number;
	wIndex: number;
	calculateChecksum(): number;
	build(mode: ConnectionMode): Buffer | Buffer[];
	toString(): string;
}
