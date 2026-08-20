import type { DetectedDevice } from '../../shared/app-types.js';
import {
	compatibleModelsForProductId,
	DEVICE_VENDOR_ID,
	isKnownProductId,
	protocolForProductId,
} from '../../shared/device-profiles.js';
import { windowsHidPhysicalKey } from './windowsHid.js';

interface UsbDevice {
	vendorId: number;
	productId: number;
	deviceVersionMajor: number;
	deviceVersionMinor: number;
	deviceVersionSubminor: number;
	configurations: Array<{ configurationValue: number }>;
	opened: boolean;
	manufacturerName?: string | null;
	productName?: string | null;
	serialNumber?: string | null;
	bus?: string;
	address?: number;
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
	getDevices?: () => Promise<UsbDevice[]>;
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

interface HidBinding {
	HIDAsync: { open(path: string): Promise<HidDeviceHandle> };
	devicesAsync(vendorId?: number, productId?: number): Promise<HidDeviceInfo[]>;
}

const WINDOWS_HID_VENDOR_ID = DEVICE_VENDOR_ID;
const WINDOWS_HID_PRODUCT_IDS = new Set([0xfa55, 0xfa60, 0xfa61]);
const WINDOWS_HID_INTERFACE = 2;

let usbBindingPromise: Promise<UsbBinding> | null = null;
let hidBindingPromise: Promise<HidBinding> | null = null;

function getUsbBinding(): Promise<UsbBinding> {
	usbBindingPromise ??= import('usb').then((usbPackage) => {
		const loadedUsb = usbPackage as UsbBinding;
		return loadedUsb.usb ?? loadedUsb.default ?? loadedUsb;
	});
	return usbBindingPromise;
}

function getHidBinding(): Promise<HidBinding> {
	hidBindingPromise ??= import('node-hid').then((module) => module as unknown as HidBinding);
	return hidBindingPromise;
}

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
		const HID = await getHidBinding();
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
		try {
			return await withTimeout(
				featureHandle.sendFeatureReport(Array.from(data)),
				_timeout,
				'Windows HID feature-report write timed out',
			);
		} catch (error) {
			this.opened = false;
			this.featureHandle = null;
			this.inputHandle = null;
			await featureHandle.close().catch(() => undefined);
			throw error;
		}
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

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
		operation.then(
			(value) => {
				clearTimeout(timeout);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timeout);
				reject(error);
			},
		);
	});
}

async function findWindowsHidDevice(vendorId: number, productId: number): Promise<UsbDevice | null> {
	if (process.platform !== 'win32') return null;
	if (vendorId !== WINDOWS_HID_VENDOR_ID || !WINDOWS_HID_PRODUCT_IDS.has(productId)) return null;

	const HID = await getHidBinding();
	const devices = (await HID.devicesAsync(vendorId, productId)) as HidDeviceInfo[];
	const matches = devices.filter((device) => device.vendorId === vendorId && device.productId === productId);
	const interfaceMatches = matches.filter(
		(device) => device.interface === WINDOWS_HID_INTERFACE && typeof device.path === 'string',
	);
	const featureDevice =
		interfaceMatches.find((device) => device.path?.toLowerCase().includes('col04')) ??
		interfaceMatches.find((device) => device.usagePage === 0x01 && device.usage === 0x80) ??
		interfaceMatches[0];
	const featureKey = featureDevice ? windowsHidPhysicalKey(featureDevice) : null;
	const inputDevice = featureKey
		? (matches.find(
				(device) =>
					device.interface === WINDOWS_HID_INTERFACE &&
					device.usagePage === 0x0a &&
					windowsHidPhysicalKey(device) === featureKey,
			) ?? null)
		: null;

	return featureDevice ? new WindowsHidUsbDevice(featureDevice, inputDevice) : null;
}

async function listWindowsKnownDevices(): Promise<DetectedDevice[]> {
	if (process.platform !== 'win32') return [];
	const HID = await getHidBinding();
	const devices = (await HID.devicesAsync()) as HidDeviceInfo[];
	const grouped = new Map<string, HidDeviceInfo[]>();
	for (const device of devices) {
		if (device.vendorId !== WINDOWS_HID_VENDOR_ID || !isKnownProductId(device.productId)) continue;
		const key = windowsHidPhysicalKey(device);
		if (!key) continue;
		const group = grouped.get(key) ?? [];
		group.push(device);
		grouped.set(key, group);
	}

	return [...grouped.entries()]
		.map(([key, group]): DetectedDevice | null => {
			const interfaceGroup = group.filter((device) => device.interface === WINDOWS_HID_INTERFACE);
			const control =
				interfaceGroup.find((device) => device.path?.toLowerCase().includes('col04')) ??
				interfaceGroup.find((device) => device.usagePage === 0x01 && device.usage === 0x80) ??
				interfaceGroup[0];
			const productId = control?.productId;
			if (!control || !isKnownProductId(productId)) return null;
			const compatibleModels = compatibleModelsForProductId(productId);
			return {
				id: `hid:${key}`,
				vendorId: DEVICE_VENDOR_ID,
				productId,
				connectionMode: productId === 0xfa60 ? 'Adapter' : 'Wired',
				protocol: protocolForProductId(productId),
				manufacturer: control.manufacturer ?? null,
				product: control.product ?? null,
				serialNumber: control.serialNumber ?? null,
				compatibleModels,
				ambiguous: compatibleModels.length > 1,
			};
		})
		.filter((device): device is DetectedDevice => device !== null);
}

async function listNativeKnownDevices(): Promise<DetectedDevice[]> {
	const usbBinding = await getUsbBinding();
	if (!usbBinding.getDevices) return [];
	const devices = await usbBinding.getDevices();
	return devices
		.filter((device) => device.vendorId === DEVICE_VENDOR_ID && isKnownProductId(device.productId))
		.map((device) => {
			const compatibleModels = compatibleModelsForProductId(device.productId);
			return {
				id: `usb:${device.bus ?? 'unknown'}:${device.address ?? 'unknown'}:${device.productId}`,
				vendorId: device.vendorId,
				productId: device.productId,
				connectionMode: device.productId === 0xfa60 ? 'Adapter' : 'Wired',
				protocol: protocolForProductId(device.productId),
				manufacturer: device.manufacturerName ?? null,
				product: device.productName ?? null,
				serialNumber: device.serialNumber ?? null,
				compatibleModels,
				ambiguous: compatibleModels.length > 1,
			} satisfies DetectedDevice;
		});
}

export const usb = {
	async listKnownDevices(): Promise<DetectedDevice[]> {
		return process.platform === 'win32' ? listWindowsKnownDevices() : listNativeKnownDevices();
	},
	async findDeviceByIds(vendorId: number, productId: number): Promise<UsbDevice | null> {
		if (vendorId !== DEVICE_VENDOR_ID || !isKnownProductId(productId)) return null;
		if (process.platform === 'win32') return findWindowsHidDevice(vendorId, productId);

		const usbBinding = await getUsbBinding();
		const finder = usbBinding.findDeviceByIds ?? usbBinding.nativeFindDeviceByIds;
		if (!finder) {
			throw new Error('Installed usb module does not expose findDeviceByIds/nativeFindDeviceByIds');
		}
		return finder(vendorId, productId);
	},
};
