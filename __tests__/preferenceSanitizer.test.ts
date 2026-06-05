import { describe, expect, it } from 'bun:test';
import { sanitizePreferences } from '../src/main/utils/preferenceSanitizer.js';

describe('sanitizePreferences', () => {
	it('should pass through valid preferences unchanged', () => {
		const prefs = { lightMode: 0x20, ledSpeed: 3, keyResponse: 4, deepSleepTime: 10 };
		const result = sanitizePreferences(prefs);
		expect(result.ledSpeed).toBe(3);
		expect(result.keyResponse).toBe(4);
		expect(result.deepSleepTime).toBe(10);
	});

	it('should clamp ledSpeed below range to 3', () => {
		expect(sanitizePreferences({ ledSpeed: 0 }).ledSpeed).toBe(3);
		expect(sanitizePreferences({ ledSpeed: -1 }).ledSpeed).toBe(3);
	});

	it('should clamp ledSpeed above range to 3', () => {
		expect(sanitizePreferences({ ledSpeed: 6 }).ledSpeed).toBe(3);
		expect(sanitizePreferences({ ledSpeed: 254 }).ledSpeed).toBe(3);
	});

	it('should clamp missing ledSpeed to 3', () => {
		expect(sanitizePreferences({}).ledSpeed).toBe(3);
	});

	it('should clamp deepSleepTime below range to 10', () => {
		expect(sanitizePreferences({ deepSleepTime: 0 }).deepSleepTime).toBe(10);
	});

	it('should clamp deepSleepTime above range to 10', () => {
		expect(sanitizePreferences({ deepSleepTime: 61 }).deepSleepTime).toBe(10);
	});

	it('should clamp keyResponse below 4 to 8', () => {
		expect(sanitizePreferences({ keyResponse: 2 }).keyResponse).toBe(8);
	});

	it('should clamp keyResponse above 50 to 8', () => {
		expect(sanitizePreferences({ keyResponse: 100 }).keyResponse).toBe(8);
	});

	it('should reject odd keyResponse values', () => {
		expect(sanitizePreferences({ keyResponse: 5 }).keyResponse).toBe(8);
	});

	it('should preserve unmentioned fields', () => {
		const result = sanitizePreferences({ lightMode: 0x10, sleepTime: 5 });
		expect(result.lightMode).toBe(0x10);
		expect(result.sleepTime).toBe(5);
	});
});
