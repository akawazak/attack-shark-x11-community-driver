import { EventEmitter } from 'node:events';
import type { InEndpoint } from 'usb';
import { ConnectionMode, type Logger } from '../types.js';
import { TimeoutError } from '../errors.js';
import { bufferStartsWith } from '../utils/bufferUtils.js';

export interface BatteryMonitorEvents {
	batteryChange: [battery: number];
	error: [error: Error];
}

/**
 * Pluggable battery config for multi-model support.
 *
 * All fields default to Attack Shark X11 values when omitted,
 * ensuring zero behavioral change for existing consumers.
 */
export interface BatteryMonitorConfig {
	/**
	 * Optional header prefix used to filter interrupt data.
	 * When `null` or `undefined`, all incoming data is processed.
	 * @default Buffer.from([0x03, 0x55, 0x40, 0x01]) — X11 prefix
	 */
	headerPrefix?: Buffer | null;
	/**
	 * Extracts a battery percentage (0–100) from a received interrupt data buffer.
	 * @default (data) => data[4] — X11 raw byte
	 */
	extractValue?: (data: Buffer) => number;
}

const X11_BATTERY_CONFIG: Required<Pick<BatteryMonitorConfig, 'headerPrefix' | 'extractValue'>> = {
	headerPrefix: Buffer.from([0x03, 0x55, 0x40, 0x01]),
	extractValue: (data: Buffer): number => data[4] ?? 0,
};

export class BatteryMonitor extends EventEmitter<BatteryMonitorEvents> {
	private lastBattery: number = -1;
	private interruptEndpoint: InEndpoint;
	private connectionMode: () => ConnectionMode;
	private logger: Logger;
	private isOpen: () => boolean;
	private listenersSetup = false;
	private readonly headerPrefix: Buffer | null;
	private readonly extractValue: (data: Buffer) => number;

	constructor(
		interruptEndpoint: InEndpoint,
		connectionMode: () => ConnectionMode,
		logger: Logger,
		isOpen: () => boolean,
		config?: BatteryMonitorConfig,
	) {
		super();
		this.interruptEndpoint = interruptEndpoint;
		this.connectionMode = connectionMode;
		this.logger = logger;
		this.isOpen = isOpen;
		this.headerPrefix = config?.headerPrefix !== undefined ? config.headerPrefix : X11_BATTERY_CONFIG.headerPrefix;
		this.extractValue = config?.extractValue ?? X11_BATTERY_CONFIG.extractValue;
	}

	getBatteryLevel(timeoutMs: number): Promise<number> {
		return new Promise((resolve, reject) => {
			if (this.connectionMode() === ConnectionMode.Wired) {
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
				if (battery <= 100) {
					cleanup();
					resolve(battery);
				}
			};

			const timeout = setTimeout(() => {
				cleanup();
				reject(new TimeoutError('Timeout waiting for battery report'));
			}, timeoutMs);

			this.on('batteryChange', handleBattery);

			if (this.lastBattery !== -1 && this.lastBattery <= 100) {
				cleanup();
				resolve(this.lastBattery);
			}
		});
	}

	setupListeners(): void {
		if (this.listenersSetup) return;
		this.listenersSetup = true;

		this.interruptEndpoint.on('data', (data: Buffer) => {
			const matched =
				this.headerPrefix === null || this.headerPrefix === undefined
					? true
					: bufferStartsWith(data, this.headerPrefix);

			if (!matched) return;
			if (data.length < 5) return;

			const battery = this.extractValue(data);
			if (battery !== undefined && battery !== this.lastBattery) {
				this.lastBattery = battery;
				this.emit('batteryChange', battery);
			}
		});

		this.interruptEndpoint.on('error', (err: Error) => {
			this.emit('error', err);
		});
	}

	startPolling(): void {
		if (!this.isOpen() || !this.interruptEndpoint) return;
		try {
			const transferSize = this.interruptEndpoint.descriptor.wMaxPacketSize;
			this.interruptEndpoint.startPoll(3, transferSize);
		} catch (e) {
			this.logger.error('Failed to start polling', e);
		}
	}

	stopPolling(): void {
		if (!this.interruptEndpoint) return;
		try {
			this.interruptEndpoint.stopPoll();
		} catch (e) {
			this.logger.warn('Error stopping poll (likely already stopped):', e);
		}
	}

	destroy(): void {
		this.stopPolling();
		this.removeAllListeners();
	}
}
