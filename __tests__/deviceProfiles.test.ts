import { describe, expect, it } from 'bun:test';
import {
	compatibleModelsForProductId,
	protocolForProductId,
	selectPreferredDetectedDevice,
	validateDeviceSelection,
	WIRELESS_PID,
	X11_WIRED_PID,
	R1_WIRED_PID,
} from '../src/shared/device-profiles';
import type { DetectedDevice } from '../src/shared/app-types';

describe('device profiles', () => {
	it('treats the shared wireless receiver as ambiguous', () => {
		const compatible = compatibleModelsForProductId(WIRELESS_PID);
		expect(compatible).toContain('X11');
		expect(compatible).toContain('R1');
		expect(compatible).toContain('VXE_R1_SE_PLUS');
		expect(compatible.length).toBeGreaterThan(1);
	});

	it('uses the product ID to select the established protocol', () => {
		expect(protocolForProductId(WIRELESS_PID)).toBe('X11');
		expect(protocolForProductId(X11_WIRED_PID)).toBe('X11');
		expect(protocolForProductId(R1_WIRED_PID)).toBe('R1');
	});

	it('rejects an incompatible or unknown device selection', () => {
		expect(() => validateDeviceSelection('X11', R1_WIRED_PID)).toThrow();
		expect(() => validateDeviceSelection('UNKNOWN', WIRELESS_PID)).toThrow();
		expect(() => validateDeviceSelection('X11', 0xffff)).toThrow();
	});

	it('prefers the wired identity while the receiver remains attached', () => {
		const device = (productId: number, connectionMode: 'Adapter' | 'Wired'): DetectedDevice => ({
			id: `${connectionMode}:${productId}`,
			vendorId: 0x1d57,
			productId,
			connectionMode,
			protocol: 'X11',
			manufacturer: null,
			product: null,
			serialNumber: null,
			compatibleModels: ['X11'],
			ambiguous: connectionMode === 'Adapter',
		});
		const receiver = device(WIRELESS_PID, 'Adapter');
		const wired = device(X11_WIRED_PID, 'Wired');

		expect(selectPreferredDetectedDevice([receiver, wired], 'X11', 'Adapter')).toBe(wired);
		expect(selectPreferredDetectedDevice([receiver], 'X11', 'Wired')).toBe(receiver);
		const r1Wired: DetectedDevice = {
			...wired,
			id: 'R1:Wired',
			productId: R1_WIRED_PID,
			compatibleModels: ['R1'],
		};
		expect(selectPreferredDetectedDevice([receiver, r1Wired], 'X11', 'Adapter')).toBe(r1Wired);
	});
});
