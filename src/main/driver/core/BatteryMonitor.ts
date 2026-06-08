import { EventEmitter } from 'node:events';
import type { InEndpoint } from 'usb';
import { ConnectionMode, type Logger } from '../types.js';
import { TimeoutError } from '../errors.js';
import { bufferStartsWith } from '../utils/bufferUtils.js';

export interface BatteryMonitorEvents {
	batteryChange: [battery: number];
	error: [error: Error];
}

export class BatteryMonitor extends EventEmitter<BatteryMonitorEvents> {
	private lastBattery: number = -1;
	private interruptEndpoint: InEndpoint;
	private connectionMode: () => ConnectionMode;
	private logger: Logger;
	private isOpen: () => boolean;
	private listenersSetup = false;

	constructor(
		interruptEndpoint: InEndpoint,
		connectionMode: () => ConnectionMode,
		logger: Logger,
		isOpen: () => boolean,
	) {
		super();
		this.interruptEndpoint = interruptEndpoint;
		this.connectionMode = connectionMode;
		this.logger = logger;
		this.isOpen = isOpen;
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
			if (bufferStartsWith(data, Buffer.from([0x03, 0x55, 0x40, 0x01]))) {
				if (data.length < 5) return;
				const battery = data[4];
				if (battery !== undefined && battery !== this.lastBattery) {
					this.lastBattery = battery;
					this.emit('batteryChange', battery);
				}
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
