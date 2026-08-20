import { describe, expect, it } from 'bun:test';
import { FirmwareAction, KeyCode, Modifiers } from '../src/shared/macro-templates';
import { MacroMode } from '../src/shared/macro-types';
import {
	validateCustomMacro,
	validateMacroConfig,
	validatePollingRate,
	validateUserPreferences,
} from '../src/main/utils/ipcValidation';

describe('IPC validation', () => {
	it('accepts supported polling rates and rejects coercion', () => {
		expect(validatePollingRate(1000)).toBe(1000);
		expect(() => validatePollingRate('1000')).toThrow();
		expect(() => validatePollingRate(2000)).toThrow();
	});

	it('rejects unknown or malformed preference fields', () => {
		const valid = {
			lightMode: 0x20,
			ledSpeed: 2,
			keyResponse: 4,
			sleepTime: 2,
			deepSleepTime: 10,
			rgb: { r: 255, g: 0, b: 255 },
		};
		expect(validateUserPreferences(valid)).toEqual(valid);
		expect(() => validateUserPreferences({ ...valid, unexpected: true })).toThrow();
		expect(() => validateUserPreferences({ ...valid, rgb: { r: 300, g: 0, b: 0 } })).toThrow();
	});

	it('allows exactly one validated button macro at a time', () => {
		const macro = { forward: [FirmwareAction.KEYBOARD, Modifiers.NONE, KeyCode.A] };
		expect(validateMacroConfig(macro)).toEqual(macro);
		expect(() => validateMacroConfig({ ...macro, backward: macro.forward })).toThrow();
		expect(() => validateMacroConfig({ forward: [999, 0, 0] })).toThrow();
	});

	it('enforces the encoded custom-macro capacity', () => {
		const base = {
			targetButton: 3,
			playOptions: { mode: MacroMode.THE_NUMBER_OF_TIME_TO_PLAY, times: 1 },
		};
		expect(
			validateCustomMacro({
				...base,
				events: [{ type: 'key', keyCode: KeyCode.A, delayMs: 10, isRelease: false }],
			}).events,
		).toHaveLength(1);
		expect(() =>
			validateCustomMacro({
				...base,
				events: Array.from({ length: 24 }, () => ({
					type: 'key',
					keyCode: KeyCode.A,
					delayMs: 2000,
					isRelease: false,
				})),
			}),
		).toThrow();
	});
});
