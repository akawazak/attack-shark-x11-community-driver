interface UsbDeviceInfo {
	vendorId: number;
	productId: number;
	deviceVersionMajor: number;
	deviceVersionMinor: number;
	configurations: Array<unknown>;
}
import { CustomMacroBuilder, type CustomMacroBuilderOptions } from '../protocols/CustomMacroBuilder.js';
import { MacroMode } from '../../../shared/macro-types.js';
import { DpiBuilder, type DpiBuilderOptions } from '../protocols/DpiBuilder.js';
import { InternalStateResetReportBuilder } from '../protocols/InternalStateResetReportBuilder.js';
import { type MacroBuilderOptions, MacrosBuilder } from '../protocols/MacrosBuilder.js';
import { PollingRateBuilder, type Rate } from '../protocols/PollingRateBuilder.js';
import { UserPreferencesBuilder, type UserPreferencesBuilderOptions } from '../protocols/UserPreferencesBuilder.js';
import { Button, ConnectionMode, type ControlTransferOptions } from '../types.js';

export interface SettingsWriterDeps {
	controlTransfer(options: ControlTransferOptions): Promise<number | Buffer>;
	checkIsOpen(): void;
	getConnectionMode(): ConnectionMode;
	getDevice(): UsbDeviceInfo;
}

export class SettingsWriter {
	private cachedUserPreferences: UserPreferencesBuilderOptions | null = null;

	constructor(private deps: SettingsWriterDeps) {}

	setDpi(options: DpiBuilder | DpiBuilderOptions): Promise<number> {
		this.deps.checkIsOpen();
		const builder = options instanceof DpiBuilder ? options : new DpiBuilder(options);

		return this.deps.controlTransfer({
			data: builder.build(this.deps.getConnectionMode()),
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	setPollingRate(rate: Rate | PollingRateBuilder): Promise<number> {
		this.deps.checkIsOpen();
		const builder = rate instanceof PollingRateBuilder ? rate : new PollingRateBuilder().setRate(rate);

		return this.deps.controlTransfer({
			data: builder.build(this.deps.getConnectionMode()),
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	setUserPreferences(options: UserPreferencesBuilder | UserPreferencesBuilderOptions): Promise<number> {
		this.deps.checkIsOpen();
		const builder = options instanceof UserPreferencesBuilder ? options : new UserPreferencesBuilder(options);

		if (!(options instanceof UserPreferencesBuilder)) {
			this.cachedUserPreferences = { ...options };
		}

		const payload = builder.build(this.deps.getConnectionMode());

		return this.deps.controlTransfer({
			data: payload,
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	getCachedUserPreferences(): UserPreferencesBuilderOptions | null {
		return this.cachedUserPreferences;
	}

	async setCustomMacro(options: CustomMacroBuilder | CustomMacroBuilderOptions): Promise<void>;
	async setCustomMacro(packets: [Buffer, Buffer, Buffer, Buffer]): Promise<void>;
	async setCustomMacro(
		optionsOrPackets: CustomMacroBuilder | CustomMacroBuilderOptions | [Buffer, Buffer, Buffer, Buffer],
	): Promise<void> {
		this.deps.checkIsOpen();

		if (Array.isArray(optionsOrPackets)) {
			const [setMacroBuffer, secondPacket, thirdPacket, fourthPacket] = optionsOrPackets;

			await this.deps.controlTransfer({
				data: setMacroBuffer,
				bmRequestType: 0x21,
				bRequest: 0x09,
				wValue: 0x0308,
				wIndex: 2,
			});

			await this.deps.controlTransfer({
				data: secondPacket,
				bmRequestType: 0x21,
				bRequest: 0x09,
				wValue: 0x0309,
				wIndex: 2,
			});

			await this.deps.controlTransfer({
				data: thirdPacket,
				bmRequestType: 0x21,
				bRequest: 0x09,
				wValue: 0x0309,
				wIndex: 2,
			});

			await this.deps.controlTransfer({
				data: fourthPacket,
				bmRequestType: 0x21,
				bRequest: 0x09,
				wValue: 0x0309,
				wIndex: 2,
			});
		} else {
			const builder =
				optionsOrPackets instanceof CustomMacroBuilder
					? optionsOrPackets
					: new CustomMacroBuilder(optionsOrPackets);
			const [setMacroBuffer, secondPacket, thirdPacket, fourthPacket] = builder.build(
				this.deps.getConnectionMode(),
			);

			await this.deps.controlTransfer({
				data: setMacroBuffer,
				bmRequestType: 0x21,
				bRequest: 0x09,
				wValue: 0x0308,
				wIndex: 2,
			});

			await this.deps.controlTransfer({
				data: secondPacket,
				bmRequestType: builder.bmRequestType,
				bRequest: builder.bRequest,
				wValue: builder.wValue,
				wIndex: builder.wIndex,
			});

			await this.deps.controlTransfer({
				data: thirdPacket,
				bmRequestType: builder.bmRequestType,
				bRequest: builder.bRequest,
				wValue: builder.wValue,
				wIndex: builder.wIndex,
			});

			await this.deps.controlTransfer({
				data: fourthPacket,
				bmRequestType: builder.bmRequestType,
				bRequest: builder.bRequest,
				wValue: builder.wValue,
				wIndex: builder.wIndex,
			});
		}
	}

	setMacro(config: MacroBuilderOptions | MacrosBuilder): Promise<number> {
		this.deps.checkIsOpen();
		const builder = config instanceof MacrosBuilder ? config : new MacrosBuilder(config);

		return this.deps.controlTransfer({
			data: builder.build(this.deps.getConnectionMode()),
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	sendInternalStateResetReportBuilder(): Promise<number> {
		this.deps.checkIsOpen();
		const builder = new InternalStateResetReportBuilder();

		return this.deps.controlTransfer({
			data: builder.build(this.deps.getConnectionMode()),
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	resetPollingRate(): Promise<number> {
		this.deps.checkIsOpen();
		const builder = new PollingRateBuilder();

		return this.deps.controlTransfer({
			data: builder.build(this.deps.getConnectionMode()),
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	resetDpi(): Promise<number> {
		this.deps.checkIsOpen();
		const builder = new DpiBuilder();

		return this.deps.controlTransfer({
			data: builder.build(this.deps.getConnectionMode()),
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	resetMacro(): Promise<number> {
		this.deps.checkIsOpen();
		const builder = new MacrosBuilder();

		return this.deps.controlTransfer({
			data: builder.build(this.deps.getConnectionMode()),
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	async resetCustomMacro(): Promise<void> {
		this.deps.checkIsOpen();
		const builder = new CustomMacroBuilder({
			playOptions: {
				mode: MacroMode.THE_NUMBER_OF_TIME_TO_PLAY,
				times: 1,
			},
			targetButton: Button.BACKWARD,
			macroEvents: [],
		});

		await this.setCustomMacro(builder);
	}

	resetUserPreferences(): Promise<number> {
		this.deps.checkIsOpen();
		const builder = new UserPreferencesBuilder().setKeyResponse(8);

		return this.deps.controlTransfer({
			data: builder.build(this.deps.getConnectionMode()),
			bmRequestType: builder.bmRequestType,
			bRequest: builder.bRequest,
			wValue: builder.wValue,
			wIndex: builder.wIndex,
		}) as Promise<number>;
	}

	getDeviceInfo(): {
		manufacturer: string;
		product: string;
		serialNumber: string;
		vendorId: string;
		productId: string;
		bcdDevice: string;
		connectionMode: string;
		interfaces: number;
	} {
		const device = this.deps.getDevice();

		return {
			manufacturer: 'Beken',
			product: 'Attack Shark X11',
			serialNumber: 'N/A',
			vendorId: `0x${device.vendorId.toString(16).padStart(4, '0')}`,
			productId: `0x${device.productId.toString(16).padStart(4, '0')}`,
			bcdDevice: `${device.deviceVersionMajor}.${device.deviceVersionMinor}`,
			connectionMode:
				this.deps.getConnectionMode() === ConnectionMode.Adapter ? 'Wireless (2.4GHz)' : 'Wired (USB)',
			interfaces: device.configurations?.length ?? 0,
		};
	}
}
