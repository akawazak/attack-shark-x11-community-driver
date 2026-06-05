import { describe, expect, it } from 'bun:test';
import { validateDpiConfig } from '../src/main/utils/validation.js';

describe('validateDpiConfig', () => {
	it('should return default config for empty object', () => {
		const result = validateDpiConfig({});
		expect(result.angleSnap).toBe(false);
		expect(result.ripplerControl).toBe(true);
		expect(result.activeStage).toBe(2);
		expect(result.dpiValues).toEqual([800, 1600, 2400, 3200, 5000, 22000]);
	});

	it('should throw for non-object input', () => {
		expect(() => validateDpiConfig(null)).toThrow('Invalid DPI configuration');
		expect(() => validateDpiConfig('string')).toThrow('Invalid DPI configuration');
		expect(() => validateDpiConfig(123)).toThrow('Invalid DPI configuration');
	});

	it('should validate angleSnap', () => {
		expect(validateDpiConfig({ angleSnap: true }).angleSnap).toBe(true);
		expect(validateDpiConfig({ angleSnap: false }).angleSnap).toBe(false);
		expect(() => validateDpiConfig({ angleSnap: 'yes' })).toThrow('Invalid angleSnap');
	});

	it('should validate ripplerControl', () => {
		expect(validateDpiConfig({ ripplerControl: false }).ripplerControl).toBe(false);
		expect(() => validateDpiConfig({ ripplerControl: 1 })).toThrow('Invalid ripplerControl');
	});

	it('should validate dpiValues array', () => {
		const values = [100, 200, 300, 400, 500, 600] as [number, number, number, number, number, number];
		const result = validateDpiConfig({ dpiValues: values });
		expect(result.dpiValues).toEqual(values);
	});

	it('should reject invalid dpiValues', () => {
		expect(() => validateDpiConfig({ dpiValues: 'not-array' })).toThrow('Invalid dpiValues');
		expect(() => validateDpiConfig({ dpiValues: [1, 2, 3] })).toThrow('Invalid dpiValues');
		expect(() => validateDpiConfig({ dpiValues: [1, 2, 3, 4, 5, -1] })).toThrow('Invalid dpiValues');
	});

	it('should validate activeStage', () => {
		expect(validateDpiConfig({ activeStage: 1 }).activeStage).toBe(1);
		expect(validateDpiConfig({ activeStage: 6 }).activeStage).toBe(6);
		expect(() => validateDpiConfig({ activeStage: 0 })).toThrow('Invalid activeStage');
		expect(() => validateDpiConfig({ activeStage: 7 })).toThrow('Invalid activeStage');
	});

	it('should preserve defaults for missing fields', () => {
		const result = validateDpiConfig({ activeStage: 4 });
		expect(result.activeStage).toBe(4);
		expect(result.angleSnap).toBe(false);
		expect(result.dpiValues).toEqual([800, 1600, 2400, 3200, 5000, 22000]);
	});
});
