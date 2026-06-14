/**
 * Connection modes supported by the driver.
 */
export enum ConnectionMode {
	/** Wireless mode via 2.4GHz adapter */
	Adapter = 0xfa60,
	/** Wired mode via USB cable (Attack Shark X11) */
	Wired = 0xfa55,
	/** Wired mode via USB cable (Attack Shark R1) */
	R1Wired = 0xfa61,
}

/**
 * Known device models supported by the driver framework.
 */
export enum DeviceModel {
	/** Attack Shark X11 */
	X11 = 'X11',
	/** Attack Shark R1 */
	R1 = 'R1',
}

/**
 * Resolves the device model from a USB product ID.
 * Returns `null` when the PID is ambiguous (e.g. wireless adapter shared across models).
 */
export function resolveDeviceModel(productId: number): DeviceModel | null {
	switch (productId) {
		case ConnectionMode.Wired:
			return DeviceModel.X11;
		case ConnectionMode.R1Wired:
			return DeviceModel.R1;
		default:
			// Wireless adapter PID (0xfa60) is shared — ambiguous without user input
			return null;
	}
}

/**
 * Base structure for USB control transfer options.
 */
interface ControlTransferBase {
	/** Request type (bmRequestType) */
	bmRequestType: number;
	/** Specific request (bRequest) */
	bRequest: number;
	/** Request value (wValue) */
	wValue: number;
	/** Request index (wIndex) */
	wIndex: number;
}

/**
 * Options for input control transfer (reading from the device).
 */
export interface ControlTransferIn extends ControlTransferBase {
	/** Size of data to be read */
	data: number;
}

/**
 * Options for output control transfer (writing to the device).
 */
export interface ControlTransferOut extends ControlTransferBase {
	/** Buffer of data to be sent */
	data: Buffer;
}

/**
 * Union of types for control transfer options.
 */
export type ControlTransferOptions = ControlTransferIn | ControlTransferOut;

/**
 * Mapping of physical mouse buttons.
 */
export enum Button {
	/** Main left button */
	LEFT = 0,
	/** Main right button */
	RIGHT = 1,
	/** Middle button (scroll click) */
	MIDDLE = 2,
	/** Forward side button */
	FORWARD = 3,
	/** Backward side button */
	BACKWARD = 4,
	/** DPI adjustment button */
	DPI = 5,
	/** Scroll up */
	SCROLL_UP = 6,
	/** Scroll down */
	SCROLL_DOWN = 7,
}

/**
 * Supported log levels.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Interface for the driver's internal logger.
 */
export interface Logger {
	/** Logs a debug message */
	debug(message: string, context?: unknown): void;

	/** Logs an informational message */
	info(message: string, context?: unknown): void;

	/** Logs a warning */
	warn(message: string, context?: unknown): void;

	/** Logs an error */
	error(message: string, context?: unknown): void;
}
