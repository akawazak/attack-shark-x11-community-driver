import { describe, expect, it, vi } from 'bun:test';
import { BatteryMonitor } from '../src/main/driver/core/BatteryMonitor.js';
import { ConnectionMode } from '../src/main/driver/types.js';

describe('BatteryMonitor', () => {
	it('ignores a one-off large battery jump but accepts three matching rises', () => {
		const monitor = new BatteryMonitor(
			{ nativeTransferIn: vi.fn(() => new Promise<Uint8Array | null>(() => undefined)) },
			3,
			() => ConnectionMode.Adapter,
			{ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
			() => true,
			{ headerPrefix: null },
		);
		const levels: number[] = [];
		monitor.on('batteryChange', (level) => levels.push(level));
		monitor.setupListeners();
		monitor.startPolling();

		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 91]));
		expect(monitor.getStatus()).toMatchObject({ level: 91, state: 'initializing', sampleCount: 1 });
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 100]));
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 91]));
		expect(monitor.getStatus()).toMatchObject({ level: 91, state: 'stable', sampleCount: 3 });
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 91]));
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 91]));
		expect(levels).toEqual([91, 91]);

		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 100]));
		expect(levels).toEqual([91, 91]);
		expect(monitor.getDiagnostics().samples.at(-1)?.reason).toBe('confirming-large-rise');
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 100]));
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 100]));
		expect(levels).toEqual([91, 91, 100]);
		expect(monitor.getDiagnostics().samples.at(-1)?.reason).toBe('confirmed-large-rise');
		monitor.destroy();
	});

	it('requires three matching reports before accepting a large drop', () => {
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
		for (let index = 0; index < 5; index++) monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 91]));
		for (let index = 0; index < 2; index++) monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 80]));
		expect(levels).toEqual([91, 91]);
		monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 80]));
		expect(levels).toEqual([91, 91, 80]);
	});

	it('keeps an unchanged valid battery value fresh', () => {
		const realNow = Date.now;
		let now = 1_700_000_000_000;
		Date.now = (): number => now;
		try {
			const monitor = new BatteryMonitor(
				{ nativeTransferIn: vi.fn(() => new Promise<Uint8Array | null>(() => undefined)) },
				3,
				() => ConnectionMode.Adapter,
				{ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
				() => true,
				{ headerPrefix: null },
			);
			monitor.setupListeners();
			monitor.startPolling();
			for (let index = 0; index < 3; index++) monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 44]));

			now += 2 * 60_000 + 1;
			expect(monitor.getStatus().state).toBe('stale');
			monitor.emit('_internalBatteryData', Buffer.from([0, 0, 0, 0, 44]));
			expect(monitor.getStatus()).toMatchObject({ state: 'stable', updatedAt: now, level: 44 });
			monitor.destroy();
		} finally {
			Date.now = realNow;
		}
	});
});
