import type { ConnectionMode, ControlTransferIn, ControlTransferOut, ControlTransferOptions } from '../types.js';

/**
 * Abstract interface for all device driver implementations.
 *
 * Defines the contract that every Attack Shark driver (X11, R1, future models)
 * must satisfy, allowing consumers to program against the abstraction
 * rather than a concrete implementation.
 */
export interface DeviceDriver {
	/** USB connection mode identifying the active PID */
	readonly connectionMode: ConnectionMode;
	/** USB product ID of the connected device */
	readonly productId: number;
	/** Minimum delay in ms between control transfers */
	readonly delayMs: number;

	/** Opens the USB device, claims the interface, and starts battery monitoring */
	open(): Promise<void>;
	/** Closes the USB device and releases all resources */
	close(): Promise<void>;

	// ── Battery ────────────────────────────────────────────────
	/** Returns the current battery level (0–100), or -1 when wired */
	getBatteryLevel(timeoutMs?: number): Promise<number>;
	/** Registers a callback for battery change events; returns an unsubscribe function */
	onBatteryChange(listener: (battery: number) => void): () => void;

	// ── EventEmitter surface (used by consumer code) ───────────
	on(event: string | symbol, listener: (...args: unknown[]) => void): this;
	removeListener(event: string | symbol, listener: (...args: unknown[]) => void): this;

	// ── Configuration ──────────────────────────────────────────
	setDpi(options: unknown): Promise<number>;
	setPollingRate(rate: unknown): Promise<number>;
	setUserPreferences(options: unknown): Promise<number>;
	getCachedUserPreferences(): unknown;
	setMacro(config: unknown): Promise<number>;
	setCustomMacro(options: unknown): Promise<void>;

	// ── Factory reset ──────────────────────────────────────────
	reset(): Promise<void>;

	// ── Device info ────────────────────────────────────────────
	getDeviceInfo(): unknown;

	// ── Low-level USB (required for read-back operations) ──────
	controlTransfer(options: ControlTransferIn): Promise<Buffer>;
	controlTransfer(options: ControlTransferOut): Promise<number>;
	controlTransfer(options: ControlTransferOptions): Promise<number | Buffer>;
}
