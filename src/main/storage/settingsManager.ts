import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppSettings, AppSettingsPatch } from '../../shared/app-types.js';
import { isDeviceModel } from '../../shared/device-profiles.js';

export type { AppSettings, AppSettingsPatch } from '../../shared/app-types.js';

const MAX_SETTINGS_BYTES = 64 * 1024;
const TABS = ['overview', 'preferences', 'dpi', 'macros', 'device-info'] as const;
const LIGHT_MODES = [0x00, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60];
const POLLING_RATES = [125, 250, 500, 1000];

const getSettingsPath = (): string => path.join(app.getPath('userData'), 'settings.json');

export const DEFAULT_SETTINGS: AppSettings = {
	lastTab: 'preferences',
	connectionMode: 'Adapter',
	deviceModel: 'X11',
	language: 'en',
	theme: 'dark',
	preferences: {
		lightMode: 0x20,
		ledSpeed: 2,
		keyResponse: 4,
		pollingRate: 1000,
		sleepTime: 2,
		deepSleepTime: 10,
		rgb: { r: 255, g: 0, b: 255 },
	},
	dpiConfig: {
		activeStage: 2,
		angleSnap: false,
		ripplerControl: true,
		dpiValues: [800, 1600, 2400, 3200, 5000, 22000],
	},
};

let cachedSettings: AppSettings | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

function cloneSettings(settings: AppSettings): AppSettings {
	return structuredClone(settings);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? Math.max(min, Math.min(max, numberValue)) : fallback;
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
	return Math.round(finiteNumber(value, fallback, min, max));
}

function normalizeSettings(value: unknown): AppSettings {
	const saved = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const preferences =
		saved['preferences'] && typeof saved['preferences'] === 'object'
			? (saved['preferences'] as Record<string, unknown>)
			: {};
	const rgb =
		preferences['rgb'] && typeof preferences['rgb'] === 'object'
			? (preferences['rgb'] as Record<string, unknown>)
			: {};
	const dpi =
		saved['dpiConfig'] && typeof saved['dpiConfig'] === 'object'
			? (saved['dpiConfig'] as Record<string, unknown>)
			: {};
	const dpiValues =
		Array.isArray(dpi['dpiValues']) && dpi['dpiValues'].length === 6
			? dpi['dpiValues']
			: DEFAULT_SETTINGS.dpiConfig.dpiValues;

	const keyResponse = integer(preferences['keyResponse'], DEFAULT_SETTINGS.preferences.keyResponse, 4, 50);
	return {
		lastTab: TABS.includes(saved['lastTab'] as AppSettings['lastTab'])
			? (saved['lastTab'] as AppSettings['lastTab'])
			: DEFAULT_SETTINGS.lastTab,
		connectionMode: saved['connectionMode'] === 'Wired' ? 'Wired' : 'Adapter',
		deviceModel: isDeviceModel(saved['deviceModel']) ? saved['deviceModel'] : DEFAULT_SETTINGS.deviceModel,
		language: saved['language'] === 'es' ? 'es' : 'en',
		theme: saved['theme'] === 'light' || saved['theme'] === 'cappuccino' ? saved['theme'] : 'dark',
		preferences: {
			lightMode: LIGHT_MODES.includes(Number(preferences['lightMode']))
				? Number(preferences['lightMode'])
				: DEFAULT_SETTINGS.preferences.lightMode,
			ledSpeed: integer(preferences['ledSpeed'], DEFAULT_SETTINGS.preferences.ledSpeed, 1, 5),
			keyResponse: keyResponse % 2 === 0 ? keyResponse : DEFAULT_SETTINGS.preferences.keyResponse,
			pollingRate: POLLING_RATES.includes(Number(preferences['pollingRate']))
				? Number(preferences['pollingRate'])
				: DEFAULT_SETTINGS.preferences.pollingRate,
			sleepTime:
				Math.round(
					finiteNumber(preferences['sleepTime'], DEFAULT_SETTINGS.preferences.sleepTime, 0.5, 30) * 2,
				) / 2,
			deepSleepTime: integer(preferences['deepSleepTime'], DEFAULT_SETTINGS.preferences.deepSleepTime, 1, 60),
			rgb: {
				r: integer(rgb['r'], DEFAULT_SETTINGS.preferences.rgb.r, 0, 255),
				g: integer(rgb['g'], DEFAULT_SETTINGS.preferences.rgb.g, 0, 255),
				b: integer(rgb['b'], DEFAULT_SETTINGS.preferences.rgb.b, 0, 255),
			},
		},
		dpiConfig: {
			activeStage: integer(
				dpi['activeStage'],
				DEFAULT_SETTINGS.dpiConfig.activeStage,
				1,
				6,
			) as AppSettings['dpiConfig']['activeStage'],
			angleSnap: typeof dpi['angleSnap'] === 'boolean' ? dpi['angleSnap'] : DEFAULT_SETTINGS.dpiConfig.angleSnap,
			ripplerControl:
				typeof dpi['ripplerControl'] === 'boolean'
					? dpi['ripplerControl']
					: DEFAULT_SETTINGS.dpiConfig.ripplerControl,
			dpiValues: dpiValues.map((item, index) =>
				integer(item, DEFAULT_SETTINGS.dpiConfig.dpiValues[index] ?? 800, 50, 22000),
			) as AppSettings['dpiConfig']['dpiValues'],
		},
	};
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
	return value as Record<string, unknown>;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
	const unknown = Object.keys(value).find((key) => !allowed.includes(key));
	if (unknown) throw new Error(`Unknown ${field} field: ${unknown}`);
}

export function validateSettingsPatch(value: unknown): AppSettingsPatch {
	const patch = requireObject(value, 'Settings patch');
	rejectUnknownKeys(
		patch,
		['lastTab', 'connectionMode', 'deviceModel', 'language', 'theme', 'preferences', 'dpiConfig'],
		'settings',
	);
	if ('lastTab' in patch && !TABS.includes(patch['lastTab'] as AppSettings['lastTab']))
		throw new Error('Invalid tab');
	if ('connectionMode' in patch && patch['connectionMode'] !== 'Adapter' && patch['connectionMode'] !== 'Wired')
		throw new Error('Invalid connection mode');
	if ('deviceModel' in patch && !isDeviceModel(patch['deviceModel'])) throw new Error('Invalid device model');
	if ('language' in patch && patch['language'] !== 'en' && patch['language'] !== 'es')
		throw new Error('Invalid language');
	if ('theme' in patch && patch['theme'] !== 'dark' && patch['theme'] !== 'light' && patch['theme'] !== 'cappuccino')
		throw new Error('Invalid theme');

	if ('preferences' in patch) {
		const preferences = requireObject(patch['preferences'], 'Preferences');
		rejectUnknownKeys(
			preferences,
			['lightMode', 'ledSpeed', 'keyResponse', 'pollingRate', 'sleepTime', 'deepSleepTime', 'rgb'],
			'preferences',
		);
		if ('rgb' in preferences) {
			const rgb = requireObject(preferences['rgb'], 'RGB');
			rejectUnknownKeys(rgb, ['r', 'g', 'b'], 'RGB');
		}
	}
	if ('dpiConfig' in patch) {
		const dpi = requireObject(patch['dpiConfig'], 'DPI configuration');
		rejectUnknownKeys(dpi, ['activeStage', 'angleSnap', 'ripplerControl', 'dpiValues'], 'DPI configuration');
		if ('dpiValues' in dpi && (!Array.isArray(dpi['dpiValues']) || dpi['dpiValues'].length !== 6)) {
			throw new Error('DPI values must contain exactly six entries');
		}
	}

	const serialized = JSON.stringify(patch);
	if (Buffer.byteLength(serialized, 'utf8') > MAX_SETTINGS_BYTES) throw new Error('Settings patch is too large');
	return structuredClone(patch) as AppSettingsPatch;
}

function mergeSettings(current: AppSettings, patch: AppSettingsPatch): AppSettings {
	return normalizeSettings({
		...current,
		...patch,
		preferences: {
			...current.preferences,
			...(patch['preferences'] ?? {}),
			rgb: { ...current.preferences.rgb, ...(patch['preferences']?.['rgb'] ?? {}) },
		},
		dpiConfig: { ...current.dpiConfig, ...(patch['dpiConfig'] ?? {}) },
	});
}

function readSettingsFromDisk(): Promise<AppSettings> {
	return fs
		.readFile(getSettingsPath(), 'utf8')
		.then((data) => {
			if (Buffer.byteLength(data, 'utf8') > MAX_SETTINGS_BYTES) throw new Error('Settings file is too large');
			return normalizeSettings(JSON.parse(data));
		})
		.catch(() => cloneSettings(DEFAULT_SETTINGS));
}

function loadSettings(): Promise<AppSettings> {
	if (cachedSettings) return Promise.resolve(cachedSettings);
	return readSettingsFromDisk().then((loadedSettings) => {
		// A concurrent operation may have populated the cache while the file was read.
		cachedSettings ??= loadedSettings;
		return cachedSettings;
	});
}

async function atomicWrite(settings: AppSettings): Promise<void> {
	const settingsPath = getSettingsPath();
	const temporaryPath = `${settingsPath}.${process.pid}.${Date.now()}.tmp`;
	await fs.mkdir(path.dirname(settingsPath), { recursive: true });
	try {
		await fs.writeFile(temporaryPath, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 });
		await fs.rename(temporaryPath, settingsPath);
	} finally {
		await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
	}
}

export async function getSettings(): Promise<AppSettings> {
	await operationQueue;
	return cloneSettings(await loadSettings());
}

export function patchSettings(value: unknown): Promise<AppSettings> {
	const patch = validateSettingsPatch(value);
	const operation = operationQueue.then(async () => {
		const next = mergeSettings(await loadSettings(), patch);
		await atomicWrite(next);
		cachedSettings = next;
		return cloneSettings(next);
	});
	operationQueue = operation.catch(() => undefined);
	return operation;
}

export function saveSettings(value: AppSettings): Promise<AppSettings> {
	return patchSettings(value);
}
