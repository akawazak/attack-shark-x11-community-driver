import { describe, expect, it, vi } from 'bun:test';
import { BatteryMonitor } from '../src/main/driver/core/BatteryMonitor.js';
import { ConnectionMode } from '../src/main/driver/types.js';

describe('BatteryMonitor', () => {
	it('ignores a one-off large battery jump', () => {
		const monitor = new BatteryMonitor(
			{ nativeTransferIn: vi.fn() },
			3,
			() => ConnectionMode.Adapter,
			{ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
			() => true,
			{ headerPrefix: null },
		);
		const levels: number[] = [];
		monitor.on('batteryChange', (level) => levels.push(level));
		monitor.setupListeners();

		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 91]));
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 100]));
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 91]));
		expect(levels).toEqual([91]);

		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 100]));
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 100]));
		expect(levels).toEqual([91, 100]);
	});
});
