import { app, BrowserWindow, ipcMain, net, shell, type IpcMainInvokeEvent } from 'electron';
import { fileURLToPath } from 'node:url';
import { join, normalize } from 'node:path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import type { AttackSharkX11 } from './driver/core/AttackSharkX11.js';
import type { AttackSharkR1 } from './driver/core/AttackSharkR1.js';
import { ConnectionMode } from './driver/types.js';
import { validateDpiConfig } from './utils/validation.js';
import {
	validateCustomMacro,
	validateMacroConfig,
	validatePollingRate,
	validateUserPreferences,
} from './utils/ipcValidation.js';
import * as profileManager from './storage/profileManager.js';
import * as settingsManager from './storage/settingsManager.js';
import { CustomMacroBuilder } from './driver/protocols/CustomMacroBuilder.js';
import type { UserPreferencesBuilderOptions } from './driver/protocols/UserPreferencesBuilder.js';
import type { MacroMode } from '../shared/macro-types.js';
import { WriteQueue } from './driver/utils/writeQueue.js';
import type { BatteryStatus, DeviceModel, DeviceProtocol, UpdateStatus } from '../shared/app-types.js';
import {
	capabilitiesForProtocol,
	DEVICE_MODEL_LABELS,
	validateDeviceSelection,
	WIRELESS_PID,
} from '../shared/device-profiles.js';
import { isAllowedExternalUrl, isNewerVersion, parseVersion } from './utils/releaseSecurity.js';

type ConnectedDriver = AttackSharkX11 | AttackSharkR1;

const RELEASES_URL = 'https://github.com/akawazak/attack-shark-x11-community-driver/releases';
const PROJECT_URL = 'https://github.com/akawazak/attack-shark-x11-community-driver';
const LATEST_RELEASE_API = 'https://api.github.com/repos/akawazak/attack-shark-x11-community-driver/releases/latest';

let mainWindow: BrowserWindow | null = null;
let driver: ConnectedDriver | null = null;
let deviceModel: DeviceModel = 'X11';
let deviceProtocol: DeviceProtocol = 'X11';
let updateStatus: UpdateStatus = { state: 'idle', currentVersion: app.getVersion() };
const connectionQueue = new WriteQueue();

function getDriver(): ConnectedDriver | null {
	return driver;
}

function setDriver(nextDriver: ConnectedDriver | null): void {
	driver = nextDriver;
}

async function connectDevice(params: unknown): Promise<{ success: boolean; error?: string }> {
	try {
		if (!params || typeof params !== 'object' || Array.isArray(params)) throw new Error('Invalid device selection');
		const raw = params as Record<string, unknown>;
		if (Object.keys(raw).some((key) => key !== 'model' && key !== 'mode'))
			throw new Error('Unknown device selection field');
		const selection = validateDeviceSelection(raw['model'], raw['mode']);

		const oldDriver = getDriver();
		if (oldDriver) {
			await oldDriver.close();
			setDriver(null);
		}

		let newDriver: ConnectedDriver;
		if (selection.protocol === 'R1') {
			const { AttackSharkR1 } = await import('./driver/core/AttackSharkR1.js');
			newDriver = new AttackSharkR1({ connectionMode: selection.productId as ConnectionMode });
		} else {
			const { AttackSharkX11 } = await import('./driver/core/AttackSharkX11.js');
			newDriver = new AttackSharkX11({ connectionMode: selection.productId as ConnectionMode });
		}

		await newDriver.open();
		newDriver.on('batteryChange', () => broadcastBatteryStatus(newDriver.getBatteryStatus()));
		setDriver(newDriver);
		deviceModel = selection.model;
		deviceProtocol = selection.protocol;
		await settingsManager.patchSettings({
			deviceModel: selection.model,
			connectionMode: selection.productId === WIRELESS_PID ? 'Adapter' : 'Wired',
		});
		return { success: true };
	} catch (error: unknown) {
		setDriver(null);
		const normalizedError = error instanceof Error ? error : new Error(String(error));
		console.error('Connection failed:', normalizedError);
		return { success: false, error: normalizedError.message };
	}
}

async function disconnectDevice(): Promise<void> {
	const connectedDriver = getDriver();
	if (!connectedDriver) return;
	setDriver(null);
	await connectedDriver.close();
}

function broadcastBatteryStatus(status: BatteryStatus): void {
	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) window.webContents.send('battery-updated', status);
	}
}

function isTrustedRendererUrl(rawUrl: string): boolean {
	try {
		const parsed = new URL(rawUrl);
		if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
			return parsed.origin === new URL(process.env['ELECTRON_RENDERER_URL']).origin;
		}
		if (parsed.protocol !== 'file:') return false;
		const expectedPath = normalize(join(__dirname, '../renderer/index.html'));
		return normalize(fileURLToPath(parsed)) === expectedPath;
	} catch {
		return false;
	}
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
	if (
		!mainWindow ||
		mainWindow.isDestroyed() ||
		event.sender !== mainWindow.webContents ||
		!event.senderFrame ||
		event.senderFrame !== event.sender.mainFrame ||
		!isTrustedRendererUrl(event.senderFrame.url)
	) {
		throw new Error('Blocked IPC request from an untrusted renderer');
	}
}

function handleTrusted<TArgs extends unknown[], TResult>(
	channel: string,
	handler: (...args: TArgs) => TResult | Promise<TResult>,
): void {
	ipcMain.handle(channel, (event, ...args) => {
		assertTrustedSender(event);
		return handler(...(args as TArgs));
	});
}

async function openTrustedExternal(rawUrl: string): Promise<boolean> {
	if (!isAllowedExternalUrl(rawUrl)) return false;
	await shell.openExternal(rawUrl);
	return true;
}

function sendUpdateStatus(status: UpdateStatus): UpdateStatus {
	updateStatus = status;
	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) window.webContents.send('update-status', status);
	}
	return status;
}

async function checkForUpdates(): Promise<UpdateStatus> {
	if (is.dev)
		return sendUpdateStatus({
			state: 'unsupported',
			currentVersion: app.getVersion(),
			message: 'Updates are checked in packaged builds.',
		});
	sendUpdateStatus({ state: 'checking', currentVersion: app.getVersion() });
	try {
		const response = await net.fetch(LATEST_RELEASE_API, {
			headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'attack-shark-x11-driver' },
		});
		if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
		const result = (await response.json()) as { tag_name?: unknown; draft?: unknown; prerelease?: unknown };
		if (result.draft === true || result.prerelease === true || typeof result.tag_name !== 'string') {
			throw new Error('The latest release metadata is invalid');
		}
		const version = result.tag_name.replace(/^v/, '');
		if (!parseVersion(version)) throw new Error('The latest release version is invalid');
		return sendUpdateStatus(
			isNewerVersion(version, app.getVersion())
				? { state: 'available', currentVersion: app.getVersion(), availableVersion: version }
				: { state: 'up-to-date', currentVersion: app.getVersion(), availableVersion: version },
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return sendUpdateStatus({ state: 'error', currentVersion: app.getVersion(), message });
	}
}

function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1125,
		height: 837,
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			backgroundThrottling: false,
			webSecurity: true,
			allowRunningInsecureContent: false,
		},
	});

	mainWindow.on('ready-to-show', () => {
		mainWindow?.show();
		if (is.dev) mainWindow?.webContents.openDevTools();
		else setTimeout(() => void checkForUpdates(), 3000);
	});
	mainWindow.on('closed', () => {
		mainWindow = null;
	});
	mainWindow.webContents.on('will-navigate', (event, url) => {
		if (!isTrustedRendererUrl(url)) event.preventDefault();
	});
	mainWindow.webContents.on('will-redirect', (event, url) => {
		if (!isTrustedRendererUrl(url)) event.preventDefault();
	});
	mainWindow.webContents.setWindowOpenHandler((details) => {
		if (isAllowedExternalUrl(details.url)) void openTrustedExternal(details.url);
		return { action: 'deny' };
	});

	if (is.dev && process.env['ELECTRON_RENDERER_URL']) mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
	else mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
}

function registerIpcHandlers(): void {
	handleTrusted('connect-device', (params: unknown) => connectionQueue.run(() => connectDevice(params), 0));
	handleTrusted('disconnect-device', () => connectionQueue.run(() => disconnectDevice(), 0));

	handleTrusted('get-battery-status', (): BatteryStatus => {
		return (
			driver?.getBatteryStatus() ?? {
				level: -1,
				state: 'unavailable',
				updatedAt: null,
				sampleCount: 0,
				rejectedCount: 0,
			}
		);
	});
	handleTrusted('get-battery-diagnostics', () => driver?.getBatteryDiagnostics() ?? null);

	handleTrusted('set-dpi', async (config: unknown) => {
		if (!driver) throw new Error('Device not connected');
		const validated = validateDpiConfig(
			config,
			deviceProtocol === 'R1' ? 18000 : 22000,
			deviceProtocol === 'R1' ? 100 : 50,
		);
		const result = await driver.setDpi(validated);
		await settingsManager.patchSettings({ dpiConfig: validated });
		return result;
	});

	handleTrusted('set-polling-rate', (rawRate: unknown) => {
		if (!driver) throw new Error('Device not connected');
		const rate = validatePollingRate(rawRate);
		if (deviceProtocol === 'R1') return (driver as AttackSharkR1).setPollingRate(rate as never);
		return (driver as AttackSharkX11).setPollingRate(rate as never);
	});

	handleTrusted('set-user-preferences', (rawPreferences: unknown) => {
		if (!driver) throw new Error('Device not connected');
		const preferences = validateUserPreferences(rawPreferences);
		if (deviceProtocol === 'R1') return (driver as AttackSharkR1).setUserPreferences(preferences as never);
		return (driver as AttackSharkX11).setUserPreferences(preferences);
	});

	handleTrusted('get-dpi', () => {
		if (!driver) throw new Error('Device not connected');
		const isWired =
			driver.connectionMode === ConnectionMode.Wired || driver.connectionMode === ConnectionMode.R1Wired;
		if (isWired) return Buffer.alloc(0);
		return driver.controlTransfer({ bmRequestType: 0xa1, bRequest: 0x01, wValue: 0x0304, wIndex: 2, data: 56 });
	});

	handleTrusted('get-summary', async () => {
		if (!driver) throw new Error('Device not connected');
		try {
			const isWired =
				driver.connectionMode === ConnectionMode.Wired || driver.connectionMode === ConnectionMode.R1Wired;
			if (isWired) {
				const cached = driver.getCachedUserPreferences() as UserPreferencesBuilderOptions | null;
				if (!cached) return null;
				if (deviceProtocol === 'R1') {
					return {
						sleepTime: cached.sleepTime ?? 0.5,
						keyResponse: cached.keyResponse ?? 4,
						deepSleepTime: cached.deepSleepTime ?? 10,
					};
				}
				return {
					lightMode: cached.lightMode ?? 0,
					ledSpeed: cached.ledSpeed ?? 3,
					rgb: cached.rgb ?? { r: 0, g: 0, b: 0 },
					sleepTime: cached.sleepTime ?? 0.5,
					keyResponse: cached.keyResponse ?? 4,
					deepSleepTime: cached.deepSleepTime ?? 10,
				};
			}

			const preferences = await driver.controlTransfer({
				bmRequestType: 0xa1,
				bRequest: 0x01,
				wValue: 0x0305,
				wIndex: 2,
				data: 15,
			});
			if (!preferences || preferences.length < 15) return null;
			if (deviceProtocol === 'R1') {
				return {
					sleepTime: (preferences[9] ?? 1) / 2,
					keyResponse: preferences[10] ?? 4,
					deepSleepTime: Math.max(1, Math.min(60, Math.round(((preferences[5] ?? 0xa8) - 0x08) / 0x10))),
				};
			}
			const hardwareSpeed = (preferences[4] ?? 0) & 0x0f;
			const ledSpeed = 6 - hardwareSpeed;
			return {
				lightMode: preferences[3] ?? 0,
				ledSpeed: ledSpeed >= 1 && ledSpeed <= 5 ? ledSpeed : 3,
				rgb: { r: preferences[6] ?? 0, g: preferences[7] ?? 0, b: preferences[8] ?? 0 },
				sleepTime: (preferences[9] ?? 1) / 2,
				keyResponse: preferences[10] ?? 4,
				deepSleepTime: Math.max(1, Math.min(60, Math.round(((preferences[5] ?? 0xa8) - 0x08) / 0x10))),
			};
		} catch (error) {
			console.error('Failed to fetch device summary:', error);
			return null;
		}
	});

	handleTrusted('get-device-info', () => {
		if (!driver) throw new Error('Device not connected');
		return {
			...driver.getDeviceInfo(),
			product: DEVICE_MODEL_LABELS[deviceModel],
			protocol: deviceProtocol,
			model: deviceModel,
		};
	});
	handleTrusted('reset-device', async () => {
		if (!driver) throw new Error('Device not connected');
		await driver.reset();
		return { success: true };
	});

	handleTrusted('set-macro', (rawConfig: unknown) => {
		if (!driver) throw new Error('Device not connected');
		if (deviceProtocol === 'R1') throw new Error('Macros are not supported by this device protocol');
		return (driver as AttackSharkX11).setMacro(validateMacroConfig(rawConfig));
	});
	handleTrusted('send-custom-macro', (rawConfig: unknown) => {
		if (!driver) throw new Error('Device not connected');
		if (deviceProtocol === 'R1') throw new Error('Macros are not supported by this device protocol');
		const config = validateCustomMacro(rawConfig);
		const builder = new CustomMacroBuilder({
			targetButton: config.targetButton,
			playOptions: config.playOptions as { mode?: MacroMode; times?: number },
		});
		for (const event of config.events) builder.addEvent(event.keyCode, event.delayMs, event.isRelease);
		return (driver as AttackSharkX11).setCustomMacro(builder);
	});

	handleTrusted('get-device-model', () => deviceModel);
	handleTrusted('get-device-protocol', () => deviceProtocol);
	handleTrusted('get-device-capabilities', () => capabilitiesForProtocol(deviceProtocol));
	handleTrusted('detect-device', async () => {
		try {
			const { usb } = await import('./driver/usb.js');
			const devices = await usb.listKnownDevices();
			return { detected: devices.length > 0, devices };
		} catch (error) {
			console.warn('Device detection failed:', error);
			return { detected: false, devices: [] };
		}
	});

	handleTrusted('list-profiles', () => profileManager.listProfiles());
	handleTrusted('save-profile', (name: unknown, data: unknown) => profileManager.saveProfile(name, data));
	handleTrusted('load-profile', (name: unknown) => profileManager.loadProfile(name));
	handleTrusted('delete-profile', (name: unknown) => profileManager.deleteProfile(name));
	handleTrusted('get-settings', () => settingsManager.getSettings());
	handleTrusted('patch-settings', (patch: unknown) => settingsManager.patchSettings(patch));

	handleTrusted('get-update-status', () => updateStatus);
	handleTrusted('check-for-updates', () => checkForUpdates());
	handleTrusted('open-release-page', (version?: unknown) => {
		if (version !== undefined && (typeof version !== 'string' || !parseVersion(version)))
			throw new Error('Invalid release version');
		const url = typeof version === 'string' ? `${RELEASES_URL}/tag/v${version}` : RELEASES_URL;
		return openTrustedExternal(url);
	});
	handleTrusted('open-project-page', () => openTrustedExternal(PROJECT_URL));
	handleTrusted('get-platform-info', () => ({
		platform: process.platform,
		portable: process.platform === 'win32' && Boolean(process.env['PORTABLE_EXECUTABLE_FILE']),
		version: app.getVersion(),
	}));
}

app.whenReady().then(() => {
	electronApp.setAppUserModelId('com.attackshark.driver');
	app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));
	registerIpcHandlers();
	createWindow();
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
	app.on('before-quit', async (event) => {
		if (!driver) return;
		event.preventDefault();
		const driverToClose = driver;
		driver = null;
		try {
			await driverToClose.close();
		} catch (error) {
			console.error('Error during driver cleanup:', error);
		} finally {
			app.quit();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
