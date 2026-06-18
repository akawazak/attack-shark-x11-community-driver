import * as usbPackage from 'usb';

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
	nativeControlTransferIn(setup: unknown, timeout: number, length: number): Promise<Uint8Array | null>;
	nativeControlTransferOut(setup: unknown, timeout: number, data?: Uint8Array | null): Promise<number>;
	nativeTransferIn(endpointNumber: number, timeout: number, length: number): Promise<Uint8Array | null>;
	nativeTransferOut(endpointNumber: number, timeout: number, data: Uint8Array): Promise<number>;
}

interface UsbBinding {
	findDeviceByIds?: (vendorId: number, productId: number) => Promise<UsbDevice | null>;
	nativeFindDeviceByIds?: (vendorId: number, productId: number) => Promise<UsbDevice | null>;
	usb?: UsbBinding;
	default?: UsbBinding;
}

const loadedUsb = usbPackage as UsbBinding;
const usbBinding = loadedUsb.usb ?? loadedUsb.default ?? loadedUsb;

export const usb = {
	async findDeviceByIds(vendorId: number, productId: number): Promise<UsbDevice | null> {
		const finder = usbBinding.findDeviceByIds ?? usbBinding.nativeFindDeviceByIds;
		if (!finder) {
			throw new Error('Installed usb module does not expose findDeviceByIds/nativeFindDeviceByIds');
		}
		return finder(vendorId, productId);
	},
};
