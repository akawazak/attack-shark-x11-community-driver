declare module 'usb' {
	type USBRequestType = 'standard' | 'class' | 'vendor';
	type USBRecipient = 'device' | 'interface' | 'endpoint' | 'other';

	interface USBControlTransferParameters {
		requestType: USBRequestType;
		recipient: USBRecipient;
		request: number;
		value: number;
		index: number;
	}

	interface UsbDevice {
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

	export function nativeFindDeviceByIds(vendorId: number, productId: number): Promise<UsbDevice | null>;

	export const usb:
		| {
				findDeviceByIds(vendorId: number, productId: number): Promise<UsbDevice | null>;
		  }
		| undefined;
}
