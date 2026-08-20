import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { windowsHidPhysicalKey } from '../src/main/driver/windowsHid.js';

describe('Windows HID responsiveness', () => {
	it('uses only the asynchronous node-hid transport in Electron main', () => {
		const source = readFileSync(join(process.cwd(), 'src', 'main', 'driver', 'usb.ts'), 'utf8');

		expect(source).toContain('HID.devicesAsync');
		expect(source).toContain('HID.HIDAsync.open');
		expect(source).toContain('await this.inputHandle.read(timeout)');
		expect(source).not.toContain('.readTimeout(');
		expect(source).not.toContain('new HID.HID(');
	});

	it('associates battery and feature collections from the same receiver', () => {
		const base = '\\\\?\\HID#VID_1D57&PID_FA60&MI_02';
		const suffix = '#8&317ab2dd&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}';
		const feature = windowsHidPhysicalKey({ path: `${base}&Col01${suffix}` });
		const battery = windowsHidPhysicalKey({ path: `${base}&Col03${suffix.replace('0000', '0002')}` });
		const otherReceiver = windowsHidPhysicalKey({
			path: `${base}&Col03${suffix.replace('317ab2dd', 'deadbeef').replace('0000', '0002')}`,
		});

		expect(feature).toBe(battery);
		expect(feature).not.toBe(otherReceiver);
	});
});
