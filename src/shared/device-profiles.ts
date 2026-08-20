import type { DetectedDevice, DeviceCapabilities, DeviceModel, DeviceProtocol } from './app-types.js';

export const DEVICE_VENDOR_ID = 0x1d57;
export const WIRELESS_PID = 0xfa60;
export const X11_WIRED_PID = 0xfa55;
export const R1_WIRED_PID = 0xfa61;

export const DEVICE_MODELS: readonly DeviceModel[] = ['X11', 'X11SE', 'R1', 'VXE_R1_SE_PLUS'];

export const DEVICE_MODEL_LABELS: Record<DeviceModel, string> = {
	X11: 'Attack Shark X11',
	X11SE: 'Attack Shark X11 SE',
	R1: 'Attack Shark R1',
	VXE_R1_SE_PLUS: 'VXE R1 SE+',
};

const X11_CAPABILITIES: DeviceCapabilities = {
	dpi: true,
	pollingRate: true,
	battery: true,
	rgb: true,
	macros: true,
	buttonRemap: true,
	lightMode: true,
	ledSpeed: true,
	sleepTime: true,
	deepSleepTime: true,
	keyResponse: true,
	rippleControl: true,
	angleSnap: true,
};

const R1_CAPABILITIES: DeviceCapabilities = {
	...X11_CAPABILITIES,
	rgb: false,
	macros: false,
	buttonRemap: false,
	lightMode: false,
	ledSpeed: false,
};

export function isDeviceModel(value: unknown): value is DeviceModel {
	return typeof value === 'string' && DEVICE_MODELS.includes(value as DeviceModel);
}

export function isKnownProductId(value: unknown): value is number {
	return value === WIRELESS_PID || value === X11_WIRED_PID || value === R1_WIRED_PID;
}

export function protocolForProductId(productId: number): DeviceProtocol {
	if (productId === R1_WIRED_PID) return 'R1';
	if (productId === WIRELESS_PID || productId === X11_WIRED_PID) return 'X11';
	throw new Error(`Unsupported device product ID 0x${productId.toString(16)}`);
}

export function compatibleModelsForProductId(productId: number): DeviceModel[] {
	if (productId === R1_WIRED_PID) return ['R1'];
	if (productId === X11_WIRED_PID) return ['X11', 'X11SE', 'VXE_R1_SE_PLUS'];
	if (productId === WIRELESS_PID) return [...DEVICE_MODELS];
	return [];
}

export function validateDeviceSelection(
	model: unknown,
	productId: unknown,
): {
	model: DeviceModel;
	productId: number;
	protocol: DeviceProtocol;
} {
	if (!isDeviceModel(model)) throw new Error('Unsupported device model');
	if (!isKnownProductId(productId)) throw new Error('Unsupported device connection mode');
	if (!compatibleModelsForProductId(productId).includes(model)) {
		throw new Error(`${DEVICE_MODEL_LABELS[model]} is not compatible with this connection mode`);
	}
	return { model, productId, protocol: protocolForProductId(productId) };
}

export function capabilitiesForProtocol(protocol: DeviceProtocol): DeviceCapabilities {
	return { ...(protocol === 'R1' ? R1_CAPABILITIES : X11_CAPABILITIES) };
}

export function selectPreferredDetectedDevice(
	devices: readonly DetectedDevice[],
	preferredModel: DeviceModel,
	preferredMode: 'Adapter' | 'Wired' = 'Adapter',
): DetectedDevice | undefined {
	const modelMatches = devices.filter((device) => device.compatibleModels.includes(preferredModel));
	const candidates = modelMatches.length > 0 ? modelMatches : devices;

	// A wired identity means the mouse is physically attached over USB, normally
	// for charging or configuration, so it is more authoritative than a receiver
	// that may remain plugged in at the same time.
	return (
		devices.find((device) => device.connectionMode === 'Wired') ??
		candidates.find((device) => device.connectionMode === preferredMode) ??
		candidates[0]
	);
}
