import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { AttackSharkX11 } from './driver/index.js';
import { ConnectionMode } from './driver/types.js';
import { validateDpiConfig } from './utils/validation.js';
import { sanitizePreferences } from './utils/preferenceSanitizer.js';
import * as profileManager from './storage/profileManager.js';
import * as settingsManager from './storage/settingsManager.js';

import { CustomMacroBuilder, type CustomMacroBuilderOptions } from './driver/protocols/CustomMacroBuilder.js';
import type { UserPreferencesBuilderOptions } from './driver/protocols/UserPreferencesBuilder.js';
import type { MacroBuilderOptions } from './driver/protocols/MacrosBuilder.js';
import type { MacroMode } from '../shared/macro-types.js';

let driver: AttackSharkX11 | null = null;
// ... (in app.whenReady())

function createWindow(): void {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: 1125,
		height: 837,
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			webSecurity: true,
			allowRunningInsecureContent: false,
		},
	});

	mainWindow.on('ready-to-show', () => {
		mainWindow.show();
		if (is.dev) {
			mainWindow.webContents.openDevTools();
		}
	});

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url);
		return { action: 'deny' };
	});

	// HMR for renderer base on electron-vite cli.
	// Load the remote URL for development or the local html file for production.
	if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
		mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
	} else {
		mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
	}
}

// App lifecycle
app.whenReady().then(() => {
	// Set app user model id for windows
	electronApp.setAppUserModelId('com.attackshark.driver');

	// Default open or close DevTools by F12 in development
	// and ignore CommandOrControl + R in production.
	// see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
	app.on('browser-window-created', (_, window) => {
		optimizer.watchWindowShortcuts(window);
	});

	// IPC Handlers
	ipcMain.handle('connect-device', async (_, mode: ConnectionMode) => {
		try {
			const oldDriver = driver;
			if (oldDriver) {
				await oldDriver.close();
			}

			const newDriver = new AttackSharkX11({ connectionMode: mode });

			await newDriver.open();

			// Setup battery listener to push to renderer
			newDriver.on('batteryChange', (level) => {
				const windows = BrowserWindow.getAllWindows();
				windows.forEach((w) => w.webContents.send('battery-updated', level));
			});

			// eslint-disable-next-line require-atomic-updates
			driver = newDriver;
			return { success: true };
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			console.error('Connection failed:', err);
			return { success: false, error: err.message };
		}
	});

	ipcMain.handle('get-battery', async () => {
		if (!driver) return -1;
		try {
			const level = await driver.getBatteryLevel();
			return level;
		} catch (err) {
			console.error('Failed to get battery:', err);
			return -1;
		}
	});

	ipcMain.handle('set-dpi', async (_, config: unknown) => {
		if (!driver) throw new Error('Device not connected');
		const validated = validateDpiConfig(config);
		const result = await driver.setDpi(validated);

		// Persist DPI config
		const settings = await settingsManager.getSettings();
		await settingsManager.saveSettings({ ...settings, dpiConfig: validated });

		return result;
	});

	ipcMain.handle('set-polling-rate', (_, rate: number) => {
		if (!driver) throw new Error('Device not connected');
		return driver.setPollingRate(rate);
	});

	ipcMain.handle('set-user-preferences', (_, prefs: UserPreferencesBuilderOptions) => {
		if (!driver) throw new Error('Device not connected');
		return driver.setUserPreferences(sanitizePreferences(prefs));
	});

	ipcMain.handle('get-dpi', () => {
		if (!driver) throw new Error('Device not connected');

		// Wired mode does not support GET_REPORT — return empty buffer
		if (driver.connectionMode === ConnectionMode.Wired) {
			return Buffer.alloc(0);
		}

		return driver.controlTransfer({
			bmRequestType: 0xa1,
			bRequest: 0x01,
			wValue: 0x0304,
			wIndex: 2,
			data: 56,
		});
	});

	ipcMain.handle('get-summary', async () => {
		if (!driver) throw new Error('Device not connected');

		try {
			const isWired = driver.connectionMode === ConnectionMode.Wired;

			// Wired mode does not support GET_REPORT — use cached preferences
			if (isWired) {
				const cached = driver.getCachedUserPreferences() as UserPreferencesBuilderOptions | null;
				if (!cached) return null;
				return {
					lightMode: cached.lightMode ?? 0,
					ledSpeed: cached.ledSpeed ?? 3,
					rgb: cached.rgb ?? { r: 0, g: 0, b: 0 },
					sleepTime: cached.sleepTime ?? 0.5,
					keyResponse: cached.keyResponse ?? 4,
					deepSleepTime: cached.deepSleepTime ?? 10,
				};
			}

			const prefs = await driver.controlTransfer({
				bmRequestType: 0xa1,
				bRequest: 0x01,
				wValue: 0x0305,
				wIndex: 2,
				data: 15,
			});

			if (!prefs || prefs.length < 15) {
				console.warn('Device response too short for summary, got', prefs?.length, 'bytes');
				return null;
			}

			const configByte = prefs[4] ?? 0;
			const hardwareSpeed = configByte & 0x0f;
			const ledSpeed = (6 - hardwareSpeed) as 1 | 2 | 3 | 4 | 5;

			return {
				lightMode: prefs[3] ?? 0,
				ledSpeed: ledSpeed >= 1 && ledSpeed <= 5 ? ledSpeed : 3,
				rgb: { r: prefs[6] ?? 0, g: prefs[7] ?? 0, b: prefs[8] ?? 0 },
				sleepTime: (prefs[9] ?? 1) / 2,
				keyResponse: prefs[10] ?? 4,
				deepSleepTime: Math.max(1, Math.min(60, Math.round(((prefs[5] ?? 0xa8) - 0x08) / 0x10))),
			};
		} catch (e) {
			console.error('Failed to fetch device summary:', e);
			return null;
		}
	});

	ipcMain.handle('get-device-info', () => {
		if (!driver) throw new Error('Device not connected');
		return driver.getDeviceInfo();
	});

	ipcMain.handle('reset-device', async () => {
		if (!driver) throw new Error('Device not connected');
		await driver.reset();
		return { success: true };
	});

	ipcMain.handle('set-macro', (_, config: MacroBuilderOptions) => {
		if (!driver) throw new Error('Device not connected');
		return driver.setMacro(config);
	});

	ipcMain.handle('set-custom-macro', (_, options: CustomMacroBuilderOptions) => {
		if (!driver) throw new Error('Device not connected');

		const builder = new CustomMacroBuilder(options);

		return driver.setCustomMacro(builder);
	});

	interface SendMacroEvent {
		keyCode: number;
		delayMs: number;
		isRelease: boolean;
	}

	ipcMain.handle(
		'send-custom-macro',
		(
			_,
			config: {
				targetButton: number;
				playOptions: { mode?: MacroMode; times?: number };
				events: SendMacroEvent[];
			},
		) => {
			if (!driver) throw new Error('Device not connected');

			const builder = new CustomMacroBuilder({
				targetButton: config.targetButton,
				playOptions: config.playOptions,
			});

			for (const event of config.events) {
				builder.addEvent(event.keyCode, event.delayMs, event.isRelease);
			}

			return driver.setCustomMacro(builder);
		},
	);

	ipcMain.handle('list-profiles', () => profileManager.listProfiles());
	ipcMain.handle('save-profile', (_, name: string, data: unknown) => profileManager.saveProfile(name, data));
	ipcMain.handle('load-profile', (_, name: string) => profileManager.loadProfile(name));
	ipcMain.handle('delete-profile', (_, name: string) => profileManager.deleteProfile(name));

	ipcMain.handle('get-settings', () => settingsManager.getSettings());
	ipcMain.handle('save-settings', (_, settings) => settingsManager.saveSettings(settings));

	createWindow();

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});

	// Ensure driver is closed when app quits
	app.on('before-quit', async (e) => {
		if (driver) {
			e.preventDefault();
			const driverToClose = driver;
			driver = null;
			try {
				await driverToClose.close();
			} catch (err) {
				console.error('Error during driver cleanup:', err);
			} finally {
				app.quit();
			}
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
