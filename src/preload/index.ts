import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron';
import type { AppSettings } from '../main/storage/settingsManager.js';

console.log('[preload] script running, contextIsolated:', process.contextIsolated);

/**
 * Inlined equivalent of @electron-toolkit/preload's electronAPI.
 * We inline it to avoid require() resolution failures in Electron's
 * sandboxed preload environment (sandbox: true).
 */
const electronAPI = {
	ipcRenderer: {
		send(channel: string, ...args: unknown[]): void {
			ipcRenderer.send(channel, ...args);
		},
		invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
			return ipcRenderer.invoke(channel, ...args);
		},
		on(channel: string, listener: (...args: unknown[]) => void): () => void {
			ipcRenderer.on(channel, listener);
			return (): void => {
				ipcRenderer.removeListener(channel, listener);
			};
		},
		once(channel: string, listener: (...args: unknown[]) => void): () => void {
			ipcRenderer.once(channel, listener);
			return (): void => {
				ipcRenderer.removeListener(channel, listener);
			};
		},
		removeListener(channel: string, listener: (...args: unknown[]) => void): void {
			ipcRenderer.removeListener(channel, listener);
		},
		removeAllListeners(channel: string): void {
			ipcRenderer.removeAllListeners(channel);
		},
		sendSync<T>(channel: string, ...args: unknown[]): T {
			return ipcRenderer.sendSync(channel, ...args);
		},
		postMessage(channel: string, message: unknown, transfer?: MessagePort[]): void {
			ipcRenderer.postMessage(channel, message, transfer);
		},
	},
	webFrame: {
		insertCSS(css: string): string {
			return webFrame.insertCSS(css);
		},
		setZoomFactor(factor: number): void {
			if (typeof factor === 'number' && factor > 0) {
				webFrame.setZoomFactor(factor);
			}
		},
		setZoomLevel(level: number): void {
			if (typeof level === 'number') {
				webFrame.setZoomLevel(level);
			}
		},
	},
	webUtils: {
		getPathForFile(file: File): string {
			return webUtils.getPathForFile(file);
		},
	},
	process: {
		get platform(): string {
			return process.platform;
		},
		get versions(): NodeJS.ProcessVersions {
			return process.versions;
		},
		get env(): NodeJS.ProcessEnv {
			return { ...process.env };
		},
	},
};

// Custom APIs for renderer
const api = {
	connectDevice: (mode: number): Promise<{ success: boolean; error?: string }> =>
		ipcRenderer.invoke('connect-device', mode),
	getBattery: (): Promise<number> => ipcRenderer.invoke('get-battery'),
	setDpi: (config: unknown): Promise<number> => ipcRenderer.invoke('set-dpi', config),
	getDpi: (): Promise<Buffer> => ipcRenderer.invoke('get-dpi'),
	resetDevice: (): Promise<{ success: boolean }> => ipcRenderer.invoke('reset-device'),
	setPollingRate: (rate: number): Promise<number> => ipcRenderer.invoke('set-polling-rate', rate),
	setUserPreferences: (prefs: unknown): Promise<number> => ipcRenderer.invoke('set-user-preferences', prefs),
	setMacro: (config: unknown): Promise<number> => ipcRenderer.invoke('set-macro', config),
	setCustomMacro: (options: unknown): Promise<void> => ipcRenderer.invoke('set-custom-macro', options),
	sendCustomMacro: (packets: Buffer[]): Promise<void> => ipcRenderer.invoke('send-custom-macro', packets),
	listProfiles: (): Promise<string[]> => ipcRenderer.invoke('list-profiles'),
	saveProfile: (name: string, data: unknown): Promise<void> => ipcRenderer.invoke('save-profile', name, data),
	loadProfile: (name: string): Promise<unknown> => ipcRenderer.invoke('load-profile', name),
	deleteProfile: (name: string): Promise<void> => ipcRenderer.invoke('delete-profile', name),
	getSettings: (): Promise<AppSettings | null> => ipcRenderer.invoke('get-settings'),
	saveSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke('save-settings', settings),
	getSummary: (): Promise<unknown> => ipcRenderer.invoke('get-summary'),
	getDeviceInfo: (): Promise<unknown> => ipcRenderer.invoke('get-device-info'),
	onBatteryUpdated: (callback: (level: number) => void): void => {
		ipcRenderer.on('battery-updated', (_event, value) => callback(value));
	},
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld('electron', electronAPI);
		console.log('[preload] exposed window.electron');
		contextBridge.exposeInMainWorld('api', api);
		console.log('[preload] exposed window.api');
	} catch (error) {
		console.error('[preload] contextBridge error:', error);
	}
} else {
	console.log('[preload] contextIsolated is false, setting window globals directly');
	window.electron = electronAPI;
	window.api = api;
}

try {
	contextBridge.exposeInMainWorld('__preloadLoaded', true);
} catch {
	/* preload diagnostics flag */
}
