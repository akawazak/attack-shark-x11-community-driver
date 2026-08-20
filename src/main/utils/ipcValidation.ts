import type { UserPreferencesBuilderOptions } from '../driver/protocols/UserPreferencesBuilder.js';
import type { MacroBuilderOptions } from '../driver/protocols/MacrosBuilder.js';
import { FirmwareAction, KeyCode, Modifiers } from '../../shared/macro-templates.js';
import { MacroMode } from '../../shared/macro-types.js';

const LIGHT_MODES = new Set([0x00, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60]);
const POLLING_RATES = new Set([125, 250, 500, 1000]);
const FIRMWARE_ACTIONS = new Set(
	Object.values(FirmwareAction).filter((value): value is number => typeof value === 'number'),
);
const MODIFIERS = new Set(Object.values(Modifiers).filter((value): value is number => typeof value === 'number'));
const KEY_CODES = new Set(Object.values(KeyCode).filter((value): value is number => typeof value === 'number'));
const MOUSE_MACRO_CODES = new Set([0xf1, 0xf2, 0xf3, 0xf4, 0xf5]);
const MACRO_FIELDS = ['left', 'right', 'middle', 'forward', 'backward', 'dpi', 'scrollUp', 'scrollDown'];

function object(value: unknown, name: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], name: string): void {
	const invalid = Object.keys(value).find((key) => !keys.includes(key));
	if (invalid) throw new Error(`Unknown ${name} field: ${invalid}`);
}

function number(value: unknown, name: string, min: number, max: number, integer = false): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
		throw new Error(`${name} is out of range`);
	}
	if (integer && !Number.isInteger(value)) throw new Error(`${name} must be an integer`);
	return value;
}

export function validatePollingRate(value: unknown): number {
	if (typeof value !== 'number' || !POLLING_RATES.has(value)) throw new Error('Unsupported polling rate');
	return value;
}

export function validateUserPreferences(value: unknown): UserPreferencesBuilderOptions {
	const preferences = object(value, 'Preferences');
	exactKeys(
		preferences,
		['lightMode', 'ledSpeed', 'keyResponse', 'sleepTime', 'deepSleepTime', 'rgb'],
		'preferences',
	);
	const lightMode = number(preferences['lightMode'], 'Light mode', 0, 0x60, true);
	if (!LIGHT_MODES.has(lightMode)) throw new Error('Unsupported light mode');
	const keyResponse = number(preferences['keyResponse'], 'Key response', 4, 50, true);
	if (keyResponse % 2 !== 0) throw new Error('Key response must use a 2 ms step');
	const rgb = object(preferences['rgb'], 'RGB');
	exactKeys(rgb, ['r', 'g', 'b'], 'RGB');
	return {
		lightMode,
		ledSpeed: number(preferences['ledSpeed'], 'LED speed', 1, 5, true) as NonNullable<
			UserPreferencesBuilderOptions['ledSpeed']
		>,
		keyResponse: keyResponse as NonNullable<UserPreferencesBuilderOptions['keyResponse']>,
		sleepTime: number(preferences['sleepTime'], 'Sleep time', 0.5, 30),
		deepSleepTime: number(preferences['deepSleepTime'], 'Deep sleep time', 1, 60, true),
		rgb: {
			r: number(rgb['r'], 'Red', 0, 255, true),
			g: number(rgb['g'], 'Green', 0, 255, true),
			b: number(rgb['b'], 'Blue', 0, 255, true),
		},
	};
}

export function validateMacroConfig(value: unknown): MacroBuilderOptions {
	const config = object(value, 'Macro configuration');
	exactKeys(config, MACRO_FIELDS, 'macro');
	if (Object.keys(config).length !== 1) throw new Error('Exactly one mouse button must be changed at a time');
	for (const tuple of Object.values(config)) {
		if (!Array.isArray(tuple) || tuple.length !== 3)
			throw new Error('Macro action must contain exactly three bytes');
		const [action, modifier, keyCode] = tuple;
		if (typeof action !== 'number' || !FIRMWARE_ACTIONS.has(action)) throw new Error('Unsupported firmware action');
		if (typeof modifier !== 'number' || !MODIFIERS.has(modifier)) throw new Error('Unsupported keyboard modifier');
		if (typeof keyCode !== 'number' || !Number.isInteger(keyCode) || keyCode < 0 || keyCode > 0xff) {
			throw new Error('Unsupported key code');
		}
	}
	return structuredClone(config) as MacroBuilderOptions;
}

export interface ValidatedCustomMacro {
	targetButton: number;
	playOptions: { mode: MacroMode; times?: number };
	events: Array<{ keyCode: number; delayMs: number; isRelease: boolean }>;
}

export function validateCustomMacro(value: unknown): ValidatedCustomMacro {
	const config = object(value, 'Custom macro');
	exactKeys(config, ['targetButton', 'playOptions', 'events'], 'custom macro');
	const targetButton = number(config['targetButton'], 'Target button', 0, 4, true);
	const playOptions = object(config['playOptions'], 'Playback options');
	exactKeys(playOptions, ['mode', 'times'], 'playback');
	const mode = number(playOptions['mode'], 'Playback mode', 0, 2, true) as MacroMode;
	if (
		![
			MacroMode.THE_NUMBER_OF_TIME_TO_PLAY,
			MacroMode.ANY_KEY_PRESS_TO_STOP_PLAYING,
			MacroMode.PRESS_AND_HOLD_RELEASE_STOP,
		].includes(mode)
	) {
		throw new Error('Unsupported playback mode');
	}
	let times: number | undefined;
	if (mode === MacroMode.THE_NUMBER_OF_TIME_TO_PLAY)
		times = number(playOptions['times'] ?? 1, 'Repeat count', 1, 255, true);
	if (!Array.isArray(config['events'])) throw new Error('Macro events must be an array');
	if (config['events'].length > 47) throw new Error('A custom macro can contain at most 47 events');

	let encodedEvents = 0;
	const events = config['events'].map((rawEvent, index) => {
		const event = object(rawEvent, `Macro event ${index + 1}`);
		exactKeys(event, ['keyCode', 'delayMs', 'isRelease', 'type'], 'macro event');
		const keyCode = number(event['keyCode'], `Event ${index + 1} key`, 0, 0xff, true);
		if (!KEY_CODES.has(keyCode) && !MOUSE_MACRO_CODES.has(keyCode))
			throw new Error(`Event ${index + 1} key is unsupported`);
		const delayMs = number(event['delayMs'], `Event ${index + 1} delay`, 0, 51_000, true);
		if (typeof event['isRelease'] !== 'boolean') throw new Error(`Event ${index + 1} release flag is invalid`);
		encodedEvents += delayMs > 1070 ? 2 : 1;
		return { keyCode, delayMs, isRelease: event['isRelease'] };
	});
	if (encodedEvents > 47) throw new Error('Custom macro delays expand beyond the 47-event device limit');
	return { targetButton, playOptions: { mode, ...(times === undefined ? {} : { times }) }, events };
}
