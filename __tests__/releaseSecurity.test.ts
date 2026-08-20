import { describe, expect, it } from 'bun:test';
import { isAllowedExternalUrl, isNewerVersion, parseVersion } from '../src/main/utils/releaseSecurity';

describe('release security helpers', () => {
	it('allows only HTTPS links inside the official repository', () => {
		expect(isAllowedExternalUrl('https://github.com/akawazak/attack-shark-x11-community-driver')).toBe(true);
		expect(isAllowedExternalUrl('https://github.com/akawazak/attack-shark-x11-community-driver/releases')).toBe(
			true,
		);
		expect(isAllowedExternalUrl('http://github.com/akawazak/attack-shark-x11-community-driver/releases')).toBe(
			false,
		);
		expect(isAllowedExternalUrl('https://github.com/akawazak/attack-shark-x11-community-driver.evil.example')).toBe(
			false,
		);
		expect(isAllowedExternalUrl('file:///tmp/update.exe')).toBe(false);
	});

	it('accepts only stable three-part versions and compares them', () => {
		expect(parseVersion('v1.5.0')).toEqual([1, 5, 0]);
		expect(parseVersion('1.5.0-beta.1')).toBeNull();
		expect(isNewerVersion('1.5.1', '1.5.0')).toBe(true);
		expect(isNewerVersion('1.4.9', '1.5.0')).toBe(false);
	});
});
