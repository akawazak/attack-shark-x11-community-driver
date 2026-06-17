import type { BaseProtocolBuilder } from '../core/BaseProtocolBuilder.js';
import { ParamsError } from '../errors.js';
import type { ConnectionMode } from '../types.js';

export enum R1Rate {
	powerSaving = 125,
	office = 250,
	gaming = 500,
	eSports = 1000,
}

export interface R1PollingRateBuilderOptions {
	rate?: R1Rate;
}

/**
 * Builder for configuring the polling rate of the Attack Shark R1.
 * Uses little-endian u16 encoding (different from X11).
 */
export class R1PollingRateBuilder implements BaseProtocolBuilder {
	public static readonly DEFAULT_OPTIONS: R1PollingRateBuilderOptions = {
		rate: R1Rate.eSports,
	};
	readonly buffer: Buffer = Buffer.alloc(9);
	public readonly bmRequestType: number = 0x21;
	public readonly bRequest: number = 0x09;
	public readonly wValue: number = 0x0306;
	public readonly wIndex: number = 2;

	constructor(options?: R1PollingRateBuilderOptions) {
		this.reset();
		if (options) {
			this.applyOptions(options);
		}
	}

	private initializeBuffer(): void {
		this.buffer.fill(0);
		this.buffer[0] = 0x06;
		this.buffer[1] = 0x09;
		this.buffer[2] = 0x01;
		// Default: 1000 Hz = 0xFE01 LE → [3]=0x01, [4]=0xFE
		this.buffer[3] = 0x01;
		this.buffer[4] = 0xfe;
	}

	private applyOptions(options: R1PollingRateBuilderOptions): void {
		if (options.rate !== undefined) this.setRate(options.rate);
	}

	public reset(): this {
		this.initializeBuffer();
		this.applyOptions(R1PollingRateBuilder.DEFAULT_OPTIONS);
		return this;
	}

	calculateChecksum(): number {
		// R1 polling rate has no checksum
		return 0;
	}

	/**
	 * Sets the polling rate.
	 * @param rate Rate option (125, 250, 500, or 1000 Hz).
	 */
	setRate(rate: R1Rate): this {
		// R1 uses little-endian u16 encoding
		const rateMap: Record<R1Rate, number> = {
			[R1Rate.powerSaving]: 0xf708,
			[R1Rate.office]: 0xfb04,
			[R1Rate.gaming]: 0xfd02,
			[R1Rate.eSports]: 0xfe01,
		};

		const value = rateMap[rate];
		if (value !== undefined) {
			this.buffer[3] = value & 0xff; // low byte
			this.buffer[4] = (value >> 8) & 0xff; // high byte
		} else {
			throw new ParamsError('rate', `Unsupported Polling Rate: ${rate}`);
		}

		return this;
	}

	build(_mode: ConnectionMode): Buffer {
		return this.buffer;
	}

	toString(): string {
		return this.buffer.toString('hex');
	}
}
