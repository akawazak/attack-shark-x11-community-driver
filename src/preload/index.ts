import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '../main/storage/settingsManager.js';

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
	sendCustomMacro: (packets: unknown): Promise<void> => ipcRenderer.invoke('send-custom-macro', packets),
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

if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld('api', api);
	} catch (error) {
		console.error('[preload] contextBridge error:', error);
	}
} else {
	window.api = api;
}
