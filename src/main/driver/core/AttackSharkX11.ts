import { usb } from 'usb';
import { EventEmitter } from 'node:events';
import { DeviceError, DriverError, InterfaceError, TimeoutError } from '../errors.js';
import type { CustomMacroBuilderOptions, CustomMacroBuilder } from '../protocols/CustomMacroBuilder.js';
import type { DpiBuilderOptions, DpiBuilder } from '../protocols/DpiBuilder.js';
import type { MacroBuilderOptions, MacrosBuilder } from '../protocols/MacrosBuilder.js';
import type { Rate, PollingRateBuilder } from '../protocols/PollingRateBuilder.js';
import type { UserPreferencesBuilderOptions, UserPreferencesBuilder } from '../protocols/UserPreferencesBuilder.js';
import {
	ConnectionMode,
	type ControlTransferIn,
	type ControlTransferOptions,
	type ControlTransferOut,
	type Logger,
} from '../types.js';
import { delay } from '../utils/delay.js';
import { ConsoleLogger } from '../logger/index.js';
import { BatteryMonitor } from './BatteryMonitor.js';
import { SettingsWriter } from './SettingsWriter.js';
import type { DeviceDriver } from './DeviceDriver.js';

// Minimal local types for the subset of WebUSB/usb v3 API we consume.
// The usb v3 package's own d.ts depends on global WebUSB types that don't
// exist in a Node.js environment, so we define what we need here.
type USBRequestType = 'standard' | 'class' | 'vendor';
type USBRecipient = 'device' | 'interface' | 'endpoint' | 'other';

interface USBControlTransferParameters {
	requestType: USBRequestType;
	recipient: USBRecipient;
	request: number;
	value: number;
	index: number;
}

interface UsbDeviceLike {
	vendorId: number;
	productId: number;
	deviceVersionMajor: number;
	deviceVersionMinor: number;
	deviceVersionSubminor: number;
	configurations: Array<{ configurationValue: number }>;
	opened: boolean;
	open(): Promise<void>;
	close(): Promise<void>;
	claimInterface(interfaceNumber: number): Promise<void>;
	releaseInterface(interfaceNumber: number): Promise<void>;
	selectConfiguration(configurationValue: number): Promise<void>;
	detachKernelDriver(interfaceNumber: number): Promise<void>;
	attachKernelDriver(interfaceNumber: number): Promise<void>;
	controlTransferIn?(setup: USBControlTransferParameters, length: number): Promise<unknown>;
	controlTransferOut?(setup: USBControlTransferParameters, data?: BufferSource): Promise<unknown>;
	nativeControlTransferIn(
		setup: USBControlTransferParameters,
		timeout: number,
		length: number,
	): Promise<Uint8Array | null>;
	nativeControlTransferOut(
		setup: USBControlTransferParameters,
		timeout: number,
		data?: Uint8Array | null,
	): Promise<number>;
	nativeTransferIn(endpointNumber: number, timeout: number, length: number): Promise<Uint8Array | null>;
	nativeTransferOut(endpointNumber: number, timeout: number, data: Uint8Array): Promise<number>;
}

const VID = 0x1d57;
const DEVICE_INTERFACE = 0x02;
const INTERRUPT_ENDPOINT = 3;
const CONTROL_TRANSFER_TIMEOUT = 1000;

const REQUEST_TYPES = ['standard', 'class', 'vendor'] as const;
const RECIPIENTS = ['device', 'interface', 'endpoint', 'other'] as const;

function parseBmRequestType(bmRequestType: number): {
	requestType: USBRequestType;
	recipient: USBRecipient;
	isIn: boolean;
} {
	const direction = (bmRequestType >> 7) & 1;
	const type = (bmRequestType >> 5) & 0x3;
	const recipient = bmRequestType & 0x1f;

	return {
		requestType: REQUEST_TYPES[type] ?? 'vendor',
		recipient: (RECIPIENTS[recipient] as USBRecipient) ?? 'interface',
		isIn: direction === 1,
	};
}

export interface AttackSharkX11Events {
	batteryChange: [battery: number];
	error: [error: Error];
}

export class AttackSharkX11 extends EventEmitter<AttackSharkX11Events> implements DeviceDriver {
	public readonly productId: number;
	device!: UsbDeviceLike;
	public readonly delayMs: number;
	private isDeviceOpen: boolean = false;
	private lastBattery: number = -1;
	private logger: Logger;
	private batteryMonitor: BatteryMonitor | null = null;
	private settingsWriter: SettingsWriter;

	constructor(options: { connectionMode: ConnectionMode; logger?: Logger; delayMs?: number }) {
		super();
		if (!options.connectionMode) {
			throw new DriverError('The type of connection was not specified');
		}

		this.logger = options.logger ?? new ConsoleLogger();
		this.delayMs = options.delayMs ?? 250;
		this.productId = options.connectionMode;

		this.settingsWriter = new SettingsWriter({
			controlTransfer: (opts): Promise<number | Buffer> => this.controlTransfer(opts),
			checkIsOpen: (): void => this.checkIsOpen(),
			getConnectionMode: (): ConnectionMode => this.connectionMode,
			getDevice: (): UsbDeviceLike => this.device,
		});
	}

	get connectionMode(): ConnectionMode {
		return this.productId as ConnectionMode;
	}

	async open(): Promise<void> {
		this.logger.info(`Searching for USB device VID:${VID.toString(16)} PID:${this.productId.toString(16)}...`);

		const device = await usb.findDeviceByIds(VID, this.productId);

		if (!device) {
			throw new DeviceError(`Device with idProduct ${this.productId} not found`);
		}

		this.device = device;

		this.logger.info(`Opening USB device VID:${VID.toString(16)} PID:${this.productId.toString(16)}...`);

		try {
			await device.open();
		} catch (e: unknown) {
			const error = e instanceof Error ? e : new Error(String(e));
			this.logger.error('Failed to open USB device', error);
			throw new DeviceError(
				`An unexpected error occurred while trying to open device ${this.connectionMode}. ${error.message}`,
				{
					cause: error,
				},
			);
		}

		if (process.platform === 'linux') {
			try {
				await device.detachKernelDriver(DEVICE_INTERFACE);
				this.logger.info('Detaching kernel driver...');
			} catch {
				// Kernel driver may not be active — that's fine
			}
		}

		// Select the first configuration (required by WebUSB)
		if (device.configurations && device.configurations.length > 0) {
			const firstConfig = device.configurations[0];
			if (firstConfig) {
				try {
					await device.selectConfiguration(firstConfig.configurationValue);
				} catch (e: unknown) {
					const error = e instanceof Error ? e : new Error(String(e));
					this.logger.warn(`selectConfiguration failed (may already be configured): ${error.message}`);
				}
			}
		}

		try {
			this.logger.info(`Claiming interface ${DEVICE_INTERFACE}...`);
			await device.claimInterface(DEVICE_INTERFACE);
		} catch (e: unknown) {
			const error = e instanceof Error ? e : new Error(String(e));
			if (error.message.includes('LIBUSB_ERROR_BUSY')) {
				this.logger.warn(`Interface ${DEVICE_INTERFACE} is already claimed. Attempting to continue...`);
			} else {
				this.logger.error(`Could not claim interface ${DEVICE_INTERFACE}`, error);
				throw new InterfaceError(
					`Could not claim interface ${DEVICE_INTERFACE}. ${error.message}`,
					DEVICE_INTERFACE,
					{ cause: error },
				);
			}
		}

		this.isDeviceOpen = true;

		this.batteryMonitor = new BatteryMonitor(
			this.device,
			INTERRUPT_ENDPOINT,
			() => this.connectionMode,
			this.logger,
			() => this.isDeviceOpen,
		);

		this.batteryMonitor.on('batteryChange', (level) => {
			this.lastBattery = level;
			this.emit('batteryChange', level);
		});

		this.batteryMonitor.on('error', (err) => {
			this.emit('error', err);
		});

		this.batteryMonitor.setupListeners();
		this.batteryMonitor.startPolling();
		this.logger.info('Device ready.');
	}

	async close(): Promise<void> {
		if (!this.isDeviceOpen) return;

		this.logger.info('Closing driver and releasing resources...');
		this.removeAllListeners();

		if (this.batteryMonitor) {
			this.batteryMonitor.destroy();
		}

		try {
			this.logger.info(`Releasing interface ${DEVICE_INTERFACE}...`);
			await this.device.releaseInterface(DEVICE_INTERFACE);
		} catch (e) {
			this.logger.error('Failed to release interface', e);
		}

		try {
			this.logger.info('Closing USB device...');
			await this.device.close();
		} catch (e: unknown) {
			const error = e instanceof Error ? e : new Error(String(e));
			if (error.message.includes('pending request')) {
				this.logger.warn('Device had pending requests during close. This is common on app exit.');
			} else {
				this.logger.error('Error while closing device', error);
			}
		}

		this.isDeviceOpen = false;
		this.logger.info('Driver closed.');
	}

	checkIsOpen(): void {
		if (!this.isDeviceOpen) throw new DriverError('You have to open the device first');
	}

	controlTransfer(options: ControlTransferIn): Promise<Buffer>;
	controlTransfer(options: ControlTransferOut): Promise<number>;
	controlTransfer(options: ControlTransferOptions): Promise<number | Buffer>;
	async controlTransfer(options: ControlTransferOptions): Promise<number | Buffer> {
		this.checkIsOpen();

		const { requestType, recipient, isIn } = parseBmRequestType(options.bmRequestType);
		const setup: USBControlTransferParameters = {
			requestType,
			recipient,
			request: options.bRequest,
			value: options.wValue,
			index: options.wIndex,
		};

		let result: number | Buffer;

		if (isIn) {
			const length = typeof options.data === 'number' ? options.data : 0;
			const data = await this.device.nativeControlTransferIn(setup, CONTROL_TRANSFER_TIMEOUT, length);
			result = data ? Buffer.from(data) : Buffer.alloc(0);
		} else {
			const data = options.data instanceof Buffer ? new Uint8Array(options.data) : undefined;
			const bytesWritten = await this.device.nativeControlTransferOut(setup, CONTROL_TRANSFER_TIMEOUT, data);
			result = bytesWritten;
		}

		if (Buffer.isBuffer(options.data)) {
			await delay(this.delayMs);
		}

		return result;
	}

	getBatteryLevel(timeoutMs = 1000): Promise<number> {
		this.checkIsOpen();

		if (this.connectionMode === ConnectionMode.Wired) {
			return Promise.resolve(-1);
		}

		if (this.batteryMonitor && !this.batteryMonitor.isPolling) {
			return Promise.resolve(-1);
		}

		return new Promise((resolve, reject) => {
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

	onBatteryChange(listener: (battery: number) => void): () => void {
		this.checkIsOpen();

		this.on('batteryChange', listener);

		return () => {
			this.removeListener('batteryChange', listener);
		};
	}

	getDeviceInfo(): ReturnType<SettingsWriter['getDeviceInfo']> {
		return this.settingsWriter.getDeviceInfo();
	}

	setPollingRate(rate: Rate | PollingRateBuilder): Promise<number> {
		return this.settingsWriter.setPollingRate(rate);
	}

	setCustomMacro(options: CustomMacroBuilder | CustomMacroBuilderOptions): Promise<void>;
	setCustomMacro(packets: [Buffer, Buffer, Buffer, Buffer]): Promise<void>;
	setCustomMacro(
		optionsOrPackets: CustomMacroBuilder | CustomMacroBuilderOptions | [Buffer, Buffer, Buffer, Buffer],
	): Promise<void> {
		return this.settingsWriter.setCustomMacro(optionsOrPackets as never);
	}

	setMacro(config: MacroBuilderOptions | MacrosBuilder): Promise<number> {
		return this.settingsWriter.setMacro(config);
	}

	setUserPreferences(options: UserPreferencesBuilder | UserPreferencesBuilderOptions): Promise<number> {
		return this.settingsWriter.setUserPreferences(options);
	}

	getCachedUserPreferences(): UserPreferencesBuilderOptions | null {
		return this.settingsWriter.getCachedUserPreferences();
	}

	sendInternalStateResetReportBuilder(): Promise<number> {
		return this.settingsWriter.sendInternalStateResetReportBuilder();
	}

	resetPollingRate(): Promise<number> {
		return this.settingsWriter.resetPollingRate();
	}

	setDpi(options: DpiBuilder | DpiBuilderOptions): Promise<number> {
		return this.settingsWriter.setDpi(options);
	}

	resetDpi(): Promise<number> {
		return this.settingsWriter.resetDpi();
	}

	resetMacro(): Promise<number> {
		return this.settingsWriter.resetMacro();
	}

	async resetCustomMacro(): Promise<void> {
		await this.settingsWriter.resetCustomMacro();
	}

	resetUserPreferences(): Promise<number> {
		return this.settingsWriter.resetUserPreferences();
	}

	async reset(): Promise<void> {
		this.checkIsOpen();
		await this.sendInternalStateResetReportBuilder();
		await this.resetDpi();
		await this.resetUserPreferences();
		await this.resetPollingRate();
		await this.resetMacro();
		await this.resetCustomMacro();
	}
}

export default AttackSharkX11;
