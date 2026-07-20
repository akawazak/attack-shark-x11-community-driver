import * as usbPackage from 'usb';
import * as HID from 'node-hid';

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

interface HidDeviceInfo {
	path?: string;
	vendorId?: number;
	productId?: number;
	interface?: number;
	usagePage?: number;
	usage?: number;
	manufacturer?: string;
	product?: string;
	serialNumber?: string;
}

interface HidDeviceHandle {
	close(): Promise<void>;
	sendFeatureReport(data: number[]): Promise<number>;
	read(timeout?: number): Promise<Buffer | undefined>;
}

const WINDOWS_HID_VENDOR_ID = 0x1d57;
const WINDOWS_HID_PRODUCT_IDS = new Set([0xfa55, 0xfa60, 0xfa61]);
const WINDOWS_HID_INTERFACE = 2;

const loadedUsb = usbPackage as UsbBinding;
const usbBinding = loadedUsb.usb ?? loadedUsb.default ?? loadedUsb;

class WindowsHidUsbDevice implements UsbDevice {
	vendorId: number;
	productId: number;
	deviceVersionMajor = 1;
	deviceVersionMinor = 0;
	deviceVersionSubminor = 0;
	configurations = [{ configurationValue: 1 }];
	opened = false;
	private featureHandle: HidDeviceHandle | null = null;
	private inputHandle: HidDeviceHandle | null = null;

	constructor(
		private readonly featureInfo: HidDeviceInfo,
		private readonly inputInfo: HidDeviceInfo | null,
	) {
		this.vendorId = featureInfo.vendorId ?? WINDOWS_HID_VENDOR_ID;
		this.productId = featureInfo.productId ?? 0;
	}

	async open(): Promise<void> {
		if (this.opened) return;
		if (!this.featureInfo.path) throw new Error('Windows HID device has no path');
		this.featureHandle = (await HID.HIDAsync.open(this.featureInfo.path)) as HidDeviceHandle;
		if (this.inputInfo?.path && this.inputInfo.path !== this.featureInfo.path) {
			try {
				this.inputHandle = (await HID.HIDAsync.open(this.inputInfo.path)) as HidDeviceHandle;
			} catch {
				this.inputHandle = null;
			}
		}
		this.opened = true;
	}

	async close(): Promise<void> {
		if (!this.opened) return;
		await this.inputHandle?.close();
		await this.featureHandle?.close();
		this.inputHandle = null;
		this.featureHandle = null;
		this.opened = false;
	}

	async claimInterface(_interfaceNumber: number): Promise<void> {
		this.ensureOpen();
	}

	async releaseInterface(_interfaceNumber: number): Promise<void> {
		this.ensureOpen();
	}

	async selectConfiguration(_configurationValue: number): Promise<void> {
		this.ensureOpen();
	}

	async detachKernelDriver(_interfaceNumber: number): Promise<void> {
		// node-hid does not expose kernel-driver lifecycle operations.
	}

	async attachKernelDriver(_interfaceNumber: number): Promise<void> {
		// node-hid does not expose kernel-driver lifecycle operations.
	}

	async nativeControlTransferIn(_setup: unknown, _timeout: number, _length: number): Promise<Uint8Array | null> {
		this.ensureOpen();
		return null;
	}

	async nativeControlTransferOut(_setup: unknown, _timeout: number, data?: Uint8Array | null): Promise<number> {
		const featureHandle = this.ensureOpen();
		if (!data || data.length === 0) return 0;
		return featureHandle.sendFeatureReport(Array.from(data));
	}

	async nativeTransferIn(_endpointNumber: number, timeout: number, _length: number): Promise<Uint8Array | null> {
		this.ensureOpen();
		if (!this.inputHandle) return null;
		const data = await this.inputHandle.read(timeout);
		return data && data.length > 0 ? Uint8Array.from(data) : null;
	}

	async nativeTransferOut(_endpointNumber: number, _timeout: number, _data: Uint8Array): Promise<number> {
		this.ensureOpen();
		throw new Error('HID interrupt writes are not supported by the Windows HID transport');
	}

	private ensureOpen(): HidDeviceHandle {
		if (!this.opened || !this.featureHandle) throw new Error('Windows HID device is not open');
		return this.featureHandle;
	}
}

async function findWindowsHidDevice(vendorId: number, productId: number): Promise<UsbDevice | null> {
	if (process.platform !== 'win32') return null;
	if (vendorId !== WINDOWS_HID_VENDOR_ID || !WINDOWS_HID_PRODUCT_IDS.has(productId)) return null;

	const devices = (await HID.devicesAsync(vendorId, productId)) as HidDeviceInfo[];
	const matches = devices.filter((device) => device.vendorId === vendorId && device.productId === productId);
	const featureDevice =
		matches.find(
			(device) =>
				device.interface === WINDOWS_HID_INTERFACE &&
				typeof device.path === 'string' &&
				device.path.toLowerCase().includes('col04'),
		) ??
		matches.find((device) => device.interface === WINDOWS_HID_INTERFACE && typeof device.path === 'string') ??
		matches.find((device) => typeof device.path === 'string');
	const inputDevice =
		matches.find(
			(device) =>
				device.interface === WINDOWS_HID_INTERFACE &&
				device.usagePage === 0x0a &&
				typeof device.path === 'string',
		) ?? null;

	return featureDevice ? new WindowsHidUsbDevice(featureDevice, inputDevice) : null;
}

export const usb = {
	async findDeviceByIds(vendorId: number, productId: number): Promise<UsbDevice | null> {
		const hidDevice = await findWindowsHidDevice(vendorId, productId);
		if (hidDevice) return hidDevice;

		const finder = usbBinding.findDeviceByIds ?? usbBinding.nativeFindDeviceByIds;
		if (!finder) {
			throw new Error('Installed usb module does not expose findDeviceByIds/nativeFindDeviceByIds');
		}
		return finder(vendorId, productId);
	},
};
