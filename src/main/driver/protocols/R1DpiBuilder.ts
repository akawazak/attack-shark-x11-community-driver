import type { BaseProtocolBuilder } from '../core/BaseProtocolBuilder.js';
import { ParamsError } from '../errors.js';
import { R1_DPI_STEP_MAP } from '../tables/r1-dpi-map.js';
import { ConnectionMode } from '../types.js';

const OFFSET = Object.freeze({
	ANGLE_SNAP: 3,
	RIPPLER_CONTROL: 4,
	STAGE_MASK_A: 6,
	STAGE_MASK_B: 7,
	EXPANDED_MASK: 16,
	CURRENT_STAGE: 24,
	CHECKSUM_HIGH_BYTE: 50,
	CHECKSUM_LOW_BYTE: 51,
	STAGES_START: 8,
});

export type StageIndex = 1 | 2 | 3 | 4 | 5 | 6;

export interface R1DpiBuilderOptions {
	angleSnap?: boolean;
	ripplerControl?: boolean;
	dpiValues?: [number, number, number, number, number, number];
	activeStage?: StageIndex;
}

/**
 * Builder for configuring DPI and sensor parameters of the Attack Shark R1.
 */
export class R1DpiBuilder implements BaseProtocolBuilder {
	public static readonly DEFAULT_OPTIONS: R1DpiBuilderOptions = {
		angleSnap: false,
		ripplerControl: true,
		dpiValues: [800, 1600, 3200, 4000, 5000, 12000],
		activeStage: 2,
	};
	readonly buffer: Buffer = Buffer.alloc(56);
	public readonly bmRequestType: number = 0x21;
	public readonly bRequest: number = 0x09;
	public readonly wValue: number = 0x0304;
	public readonly wIndex: number = 2;
	private stages: [number, number, number, number, number, number] = [800, 1600, 3200, 4000, 5000, 12000];

	constructor(options?: R1DpiBuilderOptions) {
		this.reset();
		if (options) {
			this.applyOptions(options);
		}
	}

	private initializeBuffer(): void {
		this.buffer.fill(0);
		this.buffer[0] = 0x04;
		this.buffer[1] = 0x38;
		this.buffer[2] = 0x01;

		this.buffer[5] = 0x3f;

		this.buffer[OFFSET.STAGE_MASK_A] = 0x20;
		this.buffer[OFFSET.STAGE_MASK_B] = 0x20;

		this.buffer[8] = 0x12;
		this.buffer[9] = 0x25;
		this.buffer[10] = 0x4b;
		this.buffer[11] = 0x5e;
		this.buffer[12] = 0x75;
		this.buffer[13] = 0x8d;

		this.buffer[14] = 0x00;
		this.buffer[15] = 0x00;

		this.buffer[16] = 0x00;
		this.buffer[17] = 0x00;
		this.buffer[18] = 0x00;
		this.buffer[19] = 0x00;
		this.buffer[20] = 0x00;
		this.buffer[21] = 0x01;

		this.buffer[22] = 0x00;
		this.buffer[23] = 0x00;
		this.buffer[OFFSET.CURRENT_STAGE] = 0x02;
		this.buffer[25] = 0xff;
		this.buffer[26] = 0x00;
		this.buffer[27] = 0x00;
		this.buffer[28] = 0x00;
		this.buffer[29] = 0xff;
		this.buffer[30] = 0x00;
		this.buffer[31] = 0x00;

		this.buffer[32] = 0x00;
		this.buffer[33] = 0xff;
		this.buffer[34] = 0xff;
		this.buffer[35] = 0xff;
		this.buffer[36] = 0x00;
		this.buffer[37] = 0x00;
		this.buffer[38] = 0xff;
		this.buffer[39] = 0xff;
		this.buffer[40] = 0xff;
		this.buffer[41] = 0x00;
		this.buffer[42] = 0xff;
		this.buffer[43] = 0xff;
		this.buffer[44] = 0x40;
		this.buffer[45] = 0x00;
		this.buffer[46] = 0xff;
		this.buffer[47] = 0xff;

		this.buffer[48] = 0xff;
		this.buffer[49] = 0x02;
		this.buffer[50] = 0x0f;
		this.buffer[51] = 0x68;
	}

	private applyOptions(options: R1DpiBuilderOptions): void {
		if (options.angleSnap !== undefined) this.setAngleSnap(options.angleSnap);
		if (options.ripplerControl !== undefined) this.setRipplerControl(options.ripplerControl);
		if (options.dpiValues !== undefined) this.setStages(options.dpiValues);
		if (options.activeStage !== undefined) this.setCurrentStage(options.activeStage);
	}

	public reset(): this {
		this.initializeBuffer();
		this.applyOptions(R1DpiBuilder.DEFAULT_OPTIONS);
		return this;
	}

	public setAngleSnap(active: boolean = false): this {
		this.buffer[OFFSET.ANGLE_SNAP] = active ? 0x01 : 0x00;
		return this;
	}

	public setRipplerControl(active: boolean = true): this {
		this.buffer[OFFSET.RIPPLER_CONTROL] = active ? 0x01 : 0x00;
		return this;
	}

	public setCurrentStage(stage: StageIndex): this {
		this.buffer[OFFSET.CURRENT_STAGE] = stage;
		return this;
	}

	public setDpiValue(stage: StageIndex, dpi: number): this {
		const index = stage - 1;

		this.stages[index] = dpi;
		this.buffer[OFFSET.STAGES_START + index] = this.encodeDpi(dpi);

		return this;
	}

	public setStages(stages: [number, number, number, number, number, number]): this {
		if (!Array.isArray(stages) || stages.length !== this.stages.length)
			throw new ParamsError(
				'stages',
				`You need to pass the 6 DPI values; e.g.: [800, 1600, 3200, 4000, 5000, 12000]`,
			);

		for (let i = 0; i < stages.length; i++) {
			this.setDpiValue((i + 1) as StageIndex, stages[i] ?? 0x00);
		}
		return this;
	}

	calculateChecksum(): number {
		let sum = 0;

		for (let i = 3; i <= 49; i++) {
			sum += this.buffer[i] ?? 0x00;
		}

		return sum & 0xffff;
	}

	public build(mode: ConnectionMode): Buffer {
		this.updateStageMask();
		this.updateHighStageFlags();

		const checksum = this.calculateChecksum();
		this.buffer.writeUInt16BE(checksum, OFFSET.CHECKSUM_HIGH_BYTE);

		return mode === ConnectionMode.R1Wired ? this.buffer.subarray(0, OFFSET.CHECKSUM_LOW_BYTE + 1) : this.buffer;
	}

	public toString(): string {
		return this.buffer.toString('hex');
	}

	private encodeDpi(dpi: number): number {
		const keys = Object.keys(R1_DPI_STEP_MAP)
			.map(Number)
			.sort((a, b) => a - b);

		const match = keys.find((k) => k >= dpi);

		if (match === undefined) {
			throw new ParamsError('dpi', `Unsupported DPI: ${dpi}`);
		}

		return R1_DPI_STEP_MAP[match] ?? 0x00;
	}

	private updateStageMask(): void {
		const bitValues = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20];
		let mask = 0x00;

		for (let i = 0; i < this.stages.length; i++) {
			if ((this.stages[i] ?? 0x00) > 12000) {
				mask |= bitValues[i] ?? 0x00;
			}
		}

		this.buffer[OFFSET.STAGE_MASK_A] = mask;
		this.buffer[OFFSET.STAGE_MASK_B] = mask;
	}

	private updateHighStageFlags(): void {
		for (let i = 0; i < this.stages.length; i++) {
			const dpi = this.stages[i] ?? 0x00;
			if (dpi >= 10100 && dpi <= 12000) {
				this.buffer[OFFSET.EXPANDED_MASK + i] = 0x01;
			} else {
				this.buffer[OFFSET.EXPANDED_MASK + i] = 0x00;
			}
		}
	}
}
