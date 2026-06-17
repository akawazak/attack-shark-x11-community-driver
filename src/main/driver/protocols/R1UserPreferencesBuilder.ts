import type { BaseProtocolBuilder } from '../core/BaseProtocolBuilder.js';
import { ParamsError } from '../errors.js';
import { ConnectionMode } from '../types.js';

export interface R1UserPreferencesBuilderOptions {
	/** Sleep time in minutes (0.5–30, step 0.5) */
	sleepTime?: number;

	/** Deep sleep time in minutes (1–60) */
	deepSleepTime?: number;

	/** Key response in ms (4–50, step 2) */
	keyResponse?: number;
}

/**
 * Builder for R1 user preferences (Report 0x0305).
 * Handles sleep, deep sleep, and key response time. No RGB or lighting.
 */
export class R1UserPreferencesBuilder implements BaseProtocolBuilder {
	public static readonly DEFAULT_OPTIONS: R1UserPreferencesBuilderOptions = {
		sleepTime: 0.5,
		deepSleepTime: 10,
		keyResponse: 4,
	};
	readonly buffer: Buffer;
	public readonly bmRequestType: number = 0x21;
	public readonly bRequest: number = 0x09;
	public readonly wValue: number = 0x0305;
	public readonly wIndex: number = 2;
	private deepSleepMinutes: number = 10;

	constructor(options?: R1UserPreferencesBuilderOptions) {
		this.buffer = Buffer.alloc(15);
		this.buffer[0] = 0x05;
		this.buffer[1] = 0x0f;
		this.buffer[2] = 0x01;
		this.buffer[3] = 0x00;
		this.buffer[4] = 0x03; // 0x03 | (deep_sleep >> 4)
		this.buffer[5] = 0x08; // 0x08 | ((deep_sleep & 0x0F) << 4)
		this.buffer[6] = 0x00;
		this.buffer[7] = 0x00;
		this.buffer[8] = 0xff;
		this.buffer[9] = 0x01; // sleep_time * 2 (0.5 * 2 = 1)
		this.buffer[10] = 0x02; // key_resp / 2 (4 / 2 = 2)
		this.buffer[11] = 0x01;
		this.buffer[12] = 0x20; // checksum placeholder
		this.buffer[13] = 0x00;
		this.buffer[14] = 0x00;

		const config = { ...R1UserPreferencesBuilder.DEFAULT_OPTIONS, ...options };

		if (config.deepSleepTime !== undefined) this.setDeepSleep(config.deepSleepTime);
		if (config.keyResponse !== undefined) this.setKeyResponse(config.keyResponse);
		if (config.sleepTime !== undefined) this.setSleep(config.sleepTime);
	}

	/**
	 * Sets the deep sleep timer
	 * @param minutes Time in minutes (1-60)
	 */
	setDeepSleep(minutes: number): this {
		if (minutes < 1 || minutes > 60) {
			throw new ParamsError('deepSleepTime', 'the minutes of deep sleep should be in the range of 1 to 60');
		}
		this.deepSleepMinutes = minutes;
		this.buffer[4] = (0x03 | ((minutes >> 4) & 0x0f)) & 0xff;
		this.buffer[5] = (0x08 | ((minutes & 0x0f) << 4)) & 0xff;
		return this;
	}

	/**
	 * Sets the sleep timer (normal sleep)
	 * @param minutes Time in minutes (0.5 to 30, step 0.5)
	 */
	setSleep(minutes: number): this {
		if (minutes < 0.5 || minutes > 30) {
			throw new ParamsError('sleepTime', 'Invalid sleep value (0.5–30 min)');
		}
		this.buffer[9] = Math.round(minutes * 2);
		return this;
	}

	/**
	 * Sets the key response time (debounce)
	 * @param ms Time in milliseconds (4-50ms, must be even)
	 */
	setKeyResponse(ms: number): this {
		if (ms < 4 || ms > 50 || ms % 2 !== 0) {
			throw new ParamsError('keyResponse', 'Invalid value (use 4–50ms, step 2)');
		}

		this.buffer[10] = ms / 2;
		return this;
	}

	calculateChecksum(): number {
		const deepSleepLo = this.deepSleepMinutes & 0x0f;
		const deepSleepHi = (this.deepSleepMinutes >> 4) & 0x0f;
		const sleepByte = this.buffer[9] ?? 0;
		const keyRespByte = this.buffer[10] ?? 0;
		return (((deepSleepLo + deepSleepHi) & 0x0f) << 4) + 0x0a + sleepByte + keyRespByte;
	}

	build(mode: ConnectionMode): Buffer {
		this.buffer[12] = this.calculateChecksum() & 0xff;
		if (mode === ConnectionMode.R1Wired) return this.buffer.subarray(0, 13);
		return this.buffer;
	}

	toString(): string {
		return this.buffer.toString('hex');
	}
}
