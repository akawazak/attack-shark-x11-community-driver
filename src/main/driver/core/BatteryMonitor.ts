import { EventEmitter } from 'node:events';
import type { BatteryDiagnosticSample, BatteryDiagnostics, BatteryStatus } from '../../../shared/app-types.js';
import { ConnectionMode, type Logger } from '../types.js';
import { TimeoutError } from '../errors.js';

export interface BatteryMonitorEvents {
	batteryChange: [battery: number];
	error: [error: Error];
}

export interface BatteryMonitorConfig {
	headerPrefix?: Buffer | null;
	extractValue?: (data: Buffer) => number;
}

const X11_BATTERY_CONFIG: Required<Pick<BatteryMonitorConfig, 'headerPrefix' | 'extractValue'>> = {
	headerPrefix: Buffer.from([0x03, 0x55, 0x40, 0x01]),
	extractValue: (data: Buffer): number => data[4] ?? 0,
};
const MAX_SINGLE_REPORT_CHANGE = 5;
const INITIAL_SAMPLE_COUNT = 3;
const LARGE_CHANGE_CONFIRMATIONS = 3;
const MAX_DIAGNOSTIC_SAMPLES = 50;
const STALE_AFTER_MS = 2 * 60_000;

export class BatteryMonitor extends EventEmitter<BatteryMonitorEvents> {
	private lastBattery = -1;
	private hasStableBattery = false;
	private lastUpdated: number | null = null;
	private initialSamples: number[] = [];
	private pendingRise = -1;
	private pendingRiseCount = 0;
	private pendingDrop = -1;
	private pendingDropCount = 0;
	private sampleCount = 0;
	private rejectedCount = 0;
	private diagnostics: BatteryDiagnosticSample[] = [];
	private device: { nativeTransferIn(endpoint: number, timeout: number, length: number): Promise<Uint8Array | null> };
	private interruptEndpoint: number;
	private connectionMode: () => ConnectionMode;
	private logger: Logger;
	private isOpen: () => boolean;
	private listenersSetup = false;
	private polling = false;
	get isPolling(): boolean {
		return this.polling;
	}
	private pollTimeout: ReturnType<typeof setTimeout> | null = null;
	private readonly headerPrefix: Buffer | null;
	private readonly extractValue: (data: Buffer) => number;

	constructor(
		device: { nativeTransferIn(endpoint: number, timeout: number, length: number): Promise<Uint8Array | null> },
		interruptEndpoint: number,
		connectionMode: () => ConnectionMode,
		logger: Logger,
		isOpen: () => boolean,
		config?: BatteryMonitorConfig,
	) {
		super();
		this.device = device;
		this.interruptEndpoint = interruptEndpoint;
		this.connectionMode = connectionMode;
		this.logger = logger;
		this.isOpen = isOpen;
		this.headerPrefix = config?.headerPrefix !== undefined ? config.headerPrefix : X11_BATTERY_CONFIG.headerPrefix;
		this.extractValue = config?.extractValue ?? X11_BATTERY_CONFIG.extractValue;
	}

	getBatteryLevel(timeoutMs: number): Promise<number> {
		return new Promise((resolve, reject) => {
			if (this.connectionMode() === ConnectionMode.Wired || this.connectionMode() === ConnectionMode.R1Wired) {
				resolve(-1);
				return;
			}

			let finished = false;
			const cleanup = (): void => {
				if (finished) return;
				finished = true;
				clearTimeout(timeout);
				this.removeListener('batteryChange', handleBattery);
			};
			const handleBattery = (battery: number): void => {
				if (finished) return;
				cleanup();
				resolve(battery);
			};
			const timeout = setTimeout(() => {
				cleanup();
				reject(new TimeoutError('Timeout waiting for a stable battery report'));
			}, timeoutMs);

			this.on('batteryChange', handleBattery);
			if (this.lastBattery >= 0 && this.lastBattery <= 100) {
				cleanup();
				resolve(this.lastBattery);
			}
		});
	}

	getStatus(): BatteryStatus {
		if (!this.polling) {
			return {
				level: -1,
				state: 'unavailable',
				updatedAt: this.lastUpdated,
				sampleCount: this.sampleCount,
				rejectedCount: this.rejectedCount,
			};
		}
		const stale =
			this.hasStableBattery && this.lastUpdated !== null && Date.now() - this.lastUpdated > STALE_AFTER_MS;
		return {
			level: this.lastBattery,
			state: !this.hasStableBattery ? 'initializing' : stale ? 'stale' : 'stable',
			updatedAt: this.lastUpdated,
			sampleCount: this.sampleCount,
			rejectedCount: this.rejectedCount,
		};
	}

	getDiagnostics(): BatteryDiagnostics {
		return { status: this.getStatus(), samples: structuredClone(this.diagnostics) };
	}

	setupListeners(): void {
		if (this.listenersSetup) return;
		this.listenersSetup = true;

		this.on('_internalBatteryData', (data: Buffer) => {
			const matched =
				this.headerPrefix === null || this.headerPrefix === undefined
					? true
					: data.subarray(0, this.headerPrefix.length).equals(this.headerPrefix);
			if (!matched || data.length < 5) {
				this.recordSample(data, null, false, !matched ? 'signature-mismatch' : 'report-too-short');
				return;
			}

			const battery = this.extractValue(data);
			if (!Number.isInteger(battery) || battery < 0 || battery > 100) {
				this.recordSample(data, battery, false, 'value-out-of-range');
				return;
			}
			this.sampleCount += 1;

			if (!this.hasStableBattery) {
				this.initialSamples.push(battery);
				if (this.lastBattery === -1) {
					this.lastBattery = battery;
					this.lastUpdated = Date.now();
					this.emit('batteryChange', battery);
				}
				if (this.initialSamples.length < INITIAL_SAMPLE_COUNT) {
					this.recordSample(data, battery, false, 'initial-stabilization');
					return;
				}
				const stableValue = median(this.initialSamples);
				this.initialSamples = [];
				this.accept(data, stableValue, 'initial-median');
				return;
			}

			if (battery === this.lastBattery) {
				this.pendingRise = -1;
				this.pendingRiseCount = 0;
				this.pendingDrop = -1;
				this.pendingDropCount = 0;
				this.lastUpdated = Date.now();
				this.recordSample(data, battery, true, 'unchanged');
				return;
			}

			const change = battery - this.lastBattery;
			if (change > MAX_SINGLE_REPORT_CHANGE) {
				this.pendingDrop = -1;
				this.pendingDropCount = 0;
				if (this.pendingRise !== battery) {
					this.pendingRise = battery;
					this.pendingRiseCount = 1;
				} else {
					this.pendingRiseCount += 1;
				}
				if (this.pendingRiseCount < LARGE_CHANGE_CONFIRMATIONS) {
					this.recordSample(data, battery, false, 'confirming-large-rise');
					return;
				}
			}

			if (change < -MAX_SINGLE_REPORT_CHANGE) {
				this.pendingRise = -1;
				this.pendingRiseCount = 0;
				if (this.pendingDrop !== battery) {
					this.pendingDrop = battery;
					this.pendingDropCount = 1;
				} else {
					this.pendingDropCount += 1;
				}
				if (this.pendingDropCount < LARGE_CHANGE_CONFIRMATIONS) {
					this.recordSample(data, battery, false, 'confirming-large-drop');
					return;
				}
			}

			this.accept(
				data,
				battery,
				change > MAX_SINGLE_REPORT_CHANGE
					? 'confirmed-large-rise'
					: change < -MAX_SINGLE_REPORT_CHANGE
						? 'confirmed-large-drop'
						: 'normal-change',
			);
		});
	}

	private accept(data: Buffer, battery: number, reason: string): void {
		this.pendingRise = -1;
		this.pendingRiseCount = 0;
		this.pendingDrop = -1;
		this.pendingDropCount = 0;
		this.lastBattery = battery;
		this.hasStableBattery = true;
		this.lastUpdated = Date.now();
		this.recordSample(data, battery, true, reason);
		this.emit('batteryChange', battery);
	}

	private recordSample(data: Buffer, value: number | null, accepted: boolean, reason: string): void {
		if (!accepted) this.rejectedCount += 1;
		this.diagnostics.push({
			timestamp: Date.now(),
			value: Number.isFinite(value) ? value : null,
			accepted,
			reason,
			reportHex: data.subarray(0, 16).toString('hex'),
		});
		if (this.diagnostics.length > MAX_DIAGNOSTIC_SAMPLES) this.diagnostics.shift();
	}

	startPolling(): void {
		const mode = this.connectionMode();
		if (!this.isOpen() || this.polling || mode === ConnectionMode.Wired || mode === ConnectionMode.R1Wired) return;
		this.polling = true;
		this.pollLoop();
	}

	private async pollLoop(): Promise<void> {
		while (this.polling) {
			try {
				const data = await this.device.nativeTransferIn(this.interruptEndpoint, 2000, 64);
				if (data) this.emit('_internalBatteryData', Buffer.from(data).subarray(0, 64));
			} catch (error) {
				if (this.polling) {
					const message = error instanceof Error ? error.message : String(error);
					if (!message.includes('Cancelled')) this.logger.warn('Battery monitor interrupt read error', error);
				}
			}

			if (this.polling) {
				await new Promise<void>((resolve) => {
					this.pollTimeout = setTimeout(resolve, 100);
				});
			}
		}
	}

	stopPolling(): void {
		this.polling = false;
		if (this.pollTimeout) {
			clearTimeout(this.pollTimeout);
			this.pollTimeout = null;
		}
	}

	destroy(): void {
		this.stopPolling();
		this.removeAllListeners();
	}
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? -1;
}
