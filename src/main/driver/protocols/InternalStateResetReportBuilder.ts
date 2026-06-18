import type { BaseProtocolBuilder } from '../core/BaseProtocolBuilder.js';
import { ConnectionMode } from '../types.js';

const BUFFER = Buffer.from([0x0c, 0x0a, 0x01, 0xfe, 0x01, 0xfe, 0x00, 0x00, 0x00, 0x00]);

export class InternalStateResetReportBuilder implements BaseProtocolBuilder {
	readonly buffer = BUFFER;
	readonly bmRequestType = 0x21;
	readonly bRequest = 0x09;
	readonly wValue = 0x030c;
	readonly wIndex = 2;

	calculateChecksum(): number {
		return 0;
	}

	build(mode: ConnectionMode): Buffer {
		return mode === ConnectionMode.Wired ? this.buffer.subarray(0, 6) : this.buffer;
	}

	toString(): string {
		return this.buffer.toString('hex');
	}
}
