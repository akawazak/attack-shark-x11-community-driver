import type { Device, InEndpoint, Interface } from 'usb';
import * as usb from 'usb';
import { EventEmitter } from 'node:events';
import { DeviceError, DriverError, InterfaceError, ControlTransferError, TimeoutError } from '../errors.js';
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

const VID = 0x1d57;
const DEVICE_INTERFACE = 0x02;
const INTERRUPT_ENDPOINT = 0x83;

export interface AttackSharkX11Events {
	batteryChange: [battery: number];
	error: [error: Error];
}

export class AttackSharkX11 extends EventEmitter<AttackSharkX11Events> {
	public readonly productId: number;
	device: Device;
	deviceInterface!: Interface;
	interruptEndpoint!: InEndpoint;
	public readonly delayMs: number;
	private isOpen: boolean = false;
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

		const device = usb
			.getDeviceList()
			.find(
				(d) => d.deviceDescriptor.idVendor === VID && d.deviceDescriptor.idProduct === options.connectionMode,
			);

		if (!device) {
			throw new DeviceError(`Device with idProduct ${options.connectionMode} not found`);
		}

		this.device = device;
		this.productId = device.deviceDescriptor.idProduct;

		this.settingsWriter = new SettingsWriter({
			controlTransfer: (opts): Promise<number | Buffer> => this.controlTransfer(opts),
			checkIsOpen: (): void => this.checkIsOpen(),
			getConnectionMode: (): ConnectionMode => this.connectionMode,
			getDevice: (): Device => this.device,
		});
	}

	get connectionMode(): ConnectionMode {
		return this.productId as ConnectionMode;
	}

	open(): void {
		this.logger.info(`Opening USB device VID:${VID.toString(16)} PID:${this.productId.toString(16)}...`);

		try {
			this.device.open();
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

		let iface: Interface;
		try {
			iface = this.device.interface(DEVICE_INTERFACE);
		} catch (e: unknown) {
			const error = e instanceof Error ? e : new Error(String(e));
			this.logger.error(`Failed to get interface ${DEVICE_INTERFACE}`, error);
			throw new InterfaceError(`interface ${DEVICE_INTERFACE} not found`, DEVICE_INTERFACE, { cause: error });
		}

		if (!iface) {
			throw new InterfaceError(`interface ${DEVICE_INTERFACE} not found`, DEVICE_INTERFACE);
		}

		this.deviceInterface = iface;

		try {
			if (process.platform === 'linux' && iface.isKernelDriverActive()) {
				this.logger.info('Detaching kernel driver...');
				iface.detachKernelDriver();
			}

			this.logger.info(`Claiming interface ${DEVICE_INTERFACE}...`);
			iface.claim();
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

		const interruptEndpoint = iface.endpoints.find((e) => e.address === INTERRUPT_ENDPOINT);

		if (!interruptEndpoint) {
			throw new InterfaceError(`interruptEndpoint ${INTERRUPT_ENDPOINT} not found`, INTERRUPT_ENDPOINT);
		}

		this.interruptEndpoint = interruptEndpoint as InEndpoint;

		this.isOpen = true;

		this.batteryMonitor = new BatteryMonitor(
			this.interruptEndpoint,
			() => this.connectionMode,
			this.logger,
			() => this.isOpen,
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
		if (!this.isOpen) return;

		this.logger.info('Closing driver and releasing resources...');
		this.removeAllListeners();

		if (this.batteryMonitor) {
			this.batteryMonitor.destroy();
		}

		if (this.deviceInterface) {
			try {
				this.logger.info(`Releasing interface ${DEVICE_INTERFACE}...`);
				await new Promise<void>((resolve, reject) => {
					this.deviceInterface.release(true, (err) => {
						if (err) {
							this.logger.error('Error releasing interface', err);
							reject(err);
							return;
						}
						resolve();
					});
				});
			} catch (e) {
				this.logger.error('Failed to release interface', e);
			}
		}

		try {
			this.logger.info('Closing USB device...');
			this.device.close();
		} catch (e: unknown) {
			const error = e instanceof Error ? e : new Error(String(e));
			if (error.message.includes('pending request')) {
				this.logger.warn('Device had pending requests during close. This is common on app exit.');
			} else {
				this.logger.error('Error while closing device', error);
			}
		}

		this.isOpen = false;
		this.logger.info('Driver closed.');
	}

	checkIsOpen(): void {
		if (!this.isOpen) throw new DriverError('You have to open the device first');
	}

	controlTransfer(options: ControlTransferIn): Promise<Buffer>;
	controlTransfer(options: ControlTransferOut): Promise<number>;
	controlTransfer(options: ControlTransferOptions): Promise<number | Buffer>;
	async controlTransfer(options: ControlTransferOptions): Promise<number | Buffer> {
		this.checkIsOpen();

		const wValue = options.wValue;

		const result = await new Promise<number | Buffer>((resolve, reject) => {
			this.device.controlTransfer(
				options.bmRequestType,
				options.bRequest,
				wValue,
				options.wIndex,
				options.data,
				(err, res) => {
					if (err) {
						reject(new ControlTransferError('Control transfer failed', { cause: err }));
						return;
					}

					if (res === undefined) {
						reject(new ControlTransferError('Control transfer returned undefined'));
						return;
					}

					resolve(res);
				},
			);
		});

		if (Buffer.isBuffer(options.data)) {
			await delay(this.delayMs);
		}

		return result;
	}

	getBatteryLevel(timeoutMs = 1000): Promise<number> {
		this.checkIsOpen();

		return new Promise((resolve, reject) => {
			if (this.connectionMode === ConnectionMode.Wired) {
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
