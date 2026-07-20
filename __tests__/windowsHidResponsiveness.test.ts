import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Windows HID responsiveness', () => {
	it('uses only the asynchronous node-hid transport in Electron main', () => {
		const source = readFileSync(join(process.cwd(), 'src', 'main', 'driver', 'usb.ts'), 'utf8');

		expect(source).toContain('HID.devicesAsync');
		expect(source).toContain('HID.HIDAsync.open');
		expect(source).toContain('await this.inputHandle.read(timeout)');
		expect(source).not.toContain('.readTimeout(');
		expect(source).not.toContain('new HID.HID(');
	});
});
