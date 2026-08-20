import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppSettings } from '../../shared/app-types.js';

const MAX_PROFILES = 50;
const MAX_PROFILE_NAME = 64;
const MAX_STORAGE_BYTES = 256 * 1024;

const getStoragePath = (): string => path.join(app.getPath('userData'), 'profiles.json');

export interface Profile {
	name: string;
	data: AppSettings['preferences'];
}

let operationQueue: Promise<unknown> = Promise.resolve();

function validateName(value: unknown): string {
	if (typeof value !== 'string') throw new Error('Profile name must be text');
	const name = value.trim();
	if (!name || name.length > MAX_PROFILE_NAME)
		throw new Error(`Profile name must be 1-${MAX_PROFILE_NAME} characters`);
	if (/\p{C}/u.test(name)) throw new Error('Profile name contains unsupported control characters');
	return name;
}

function finiteNumber(value: unknown, field: string, min: number, max: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
		throw new Error(`${field} is out of range`);
	}
	return value;
}

function validateProfileData(value: unknown): AppSettings['preferences'] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Profile data must be an object');
	const data = value as Record<string, unknown>;
	const allowed = ['lightMode', 'ledSpeed', 'keyResponse', 'pollingRate', 'sleepTime', 'deepSleepTime', 'rgb'];
	if (Object.keys(data).some((key) => !allowed.includes(key))) throw new Error('Profile contains an unknown field');
	if (!data['rgb'] || typeof data['rgb'] !== 'object' || Array.isArray(data['rgb']))
		throw new Error('Profile RGB is invalid');
	const rgb = data['rgb'] as Record<string, unknown>;
	if (Object.keys(rgb).some((key) => !['r', 'g', 'b'].includes(key)))
		throw new Error('Profile RGB has an unknown field');
	const lightMode = finiteNumber(data['lightMode'], 'Light mode', 0, 0x60);
	if (![0x00, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60].includes(lightMode)) throw new Error('Light mode is unsupported');
	const pollingRate = finiteNumber(data['pollingRate'], 'Polling rate', 125, 1000);
	if (![125, 250, 500, 1000].includes(pollingRate)) throw new Error('Polling rate is unsupported');
	const keyResponse = finiteNumber(data['keyResponse'], 'Key response', 4, 50);
	if (!Number.isInteger(keyResponse) || keyResponse % 2 !== 0) throw new Error('Key response is unsupported');
	return {
		lightMode,
		ledSpeed: integer(data['ledSpeed'], 'LED speed', 1, 5),
		keyResponse,
		pollingRate,
		sleepTime: finiteNumber(data['sleepTime'], 'Sleep time', 0.5, 30),
		deepSleepTime: integer(data['deepSleepTime'], 'Deep sleep time', 1, 60),
		rgb: {
			r: integer(rgb['r'], 'Red', 0, 255),
			g: integer(rgb['g'], 'Green', 0, 255),
			b: integer(rgb['b'], 'Blue', 0, 255),
		},
	};
}

function integer(value: unknown, field: string, min: number, max: number): number {
	const result = finiteNumber(value, field, min, max);
	if (!Number.isInteger(result)) throw new Error(`${field} must be an integer`);
	return result;
}

function normalizeProfiles(value: unknown): Profile[] {
	if (!Array.isArray(value)) return [];
	const profiles: Profile[] = [];
	for (const item of value.slice(0, MAX_PROFILES)) {
		try {
			if (!item || typeof item !== 'object') continue;
			const candidate = item as Record<string, unknown>;
			profiles.push({ name: validateName(candidate['name']), data: validateProfileData(candidate['data']) });
		} catch {
			// Keep valid profiles even when an older/corrupt entry is unusable.
		}
	}
	return profiles;
}

async function readProfiles(): Promise<Profile[]> {
	try {
		const raw = await fs.readFile(getStoragePath(), 'utf8');
		if (Buffer.byteLength(raw, 'utf8') > MAX_STORAGE_BYTES) throw new Error('Profiles file is too large');
		return normalizeProfiles(JSON.parse(raw));
	} catch {
		return [];
	}
}

async function atomicWrite(profiles: Profile[]): Promise<void> {
	const storagePath = getStoragePath();
	const temporaryPath = `${storagePath}.${process.pid}.${Date.now()}.tmp`;
	const serialized = JSON.stringify(profiles, null, 2);
	if (Buffer.byteLength(serialized, 'utf8') > MAX_STORAGE_BYTES) throw new Error('Profiles storage limit exceeded');
	await fs.mkdir(path.dirname(storagePath), { recursive: true });
	try {
		await fs.writeFile(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600 });
		await fs.rename(temporaryPath, storagePath);
	} finally {
		await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
	}
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
	const result = operationQueue.then(operation);
	operationQueue = result.catch(() => undefined);
	return result;
}

export async function listProfiles(): Promise<string[]> {
	await operationQueue;
	return (await readProfiles()).map((profile) => profile.name);
}

export function saveProfile(rawName: unknown, rawData: unknown): Promise<void> {
	const name = validateName(rawName);
	const data = validateProfileData(rawData);
	return enqueue(async () => {
		const profiles = await readProfiles();
		const index = profiles.findIndex((profile) => profile.name.toLocaleLowerCase() === name.toLocaleLowerCase());
		if (index >= 0) profiles[index] = { name, data };
		else {
			if (profiles.length >= MAX_PROFILES) throw new Error(`A maximum of ${MAX_PROFILES} profiles is supported`);
			profiles.push({ name, data });
		}
		await atomicWrite(profiles);
	});
}

export async function loadProfile(rawName: unknown): Promise<AppSettings['preferences'] | null> {
	const name = validateName(rawName);
	await operationQueue;
	const profile = (await readProfiles()).find((item) => item.name === name);
	return profile ? structuredClone(profile.data) : null;
}

export function deleteProfile(rawName: unknown): Promise<void> {
	const name = validateName(rawName);
	return enqueue(async () => {
		const profiles = (await readProfiles()).filter((profile) => profile.name !== name);
		await atomicWrite(profiles);
	});
}
