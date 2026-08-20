import { contextBridge, ipcRenderer } from 'electron';
import type {
	AppSettings,
	AppSettingsPatch,
	BatteryDiagnostics,
	BatteryStatus,
	DeviceDetectionResult,
	DeviceModel,
	UpdateStatus,
} from '../shared/app-types.js';

// Custom APIs for renderer
const api = {
	detectDevice: (): Promise<DeviceDetectionResult> => ipcRenderer.invoke('detect-device'),
	connectDevice: (params: { model: DeviceModel; mode: number }): Promise<{ success: boolean; error?: string }> =>
		ipcRenderer.invoke('connect-device', params),
	disconnectDevice: (): Promise<void> => ipcRenderer.invoke('disconnect-device'),
	getBatteryStatus: (): Promise<BatteryStatus> => ipcRenderer.invoke('get-battery-status'),
	getBatteryDiagnostics: (): Promise<BatteryDiagnostics | null> => ipcRenderer.invoke('get-battery-diagnostics'),
	setDpi: (config: unknown): Promise<number> => ipcRenderer.invoke('set-dpi', config),
	getDpi: (): Promise<Buffer> => ipcRenderer.invoke('get-dpi'),
	resetDevice: (): Promise<{ success: boolean }> => ipcRenderer.invoke('reset-device'),
	setPollingRate: (rate: number): Promise<number> => ipcRenderer.invoke('set-polling-rate', rate),
	setUserPreferences: (prefs: unknown): Promise<number> => ipcRenderer.invoke('set-user-preferences', prefs),
	setMacro: (config: unknown): Promise<number> => ipcRenderer.invoke('set-macro', config),
	sendCustomMacro: (packets: unknown): Promise<void> => ipcRenderer.invoke('send-custom-macro', packets),
	listProfiles: (): Promise<string[]> => ipcRenderer.invoke('list-profiles'),
	saveProfile: (name: string, data: unknown): Promise<void> => ipcRenderer.invoke('save-profile', name, data),
	loadProfile: (name: string): Promise<unknown> => ipcRenderer.invoke('load-profile', name),
	deleteProfile: (name: string): Promise<void> => ipcRenderer.invoke('delete-profile', name),
	getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
	patchSettings: (patch: AppSettingsPatch): Promise<AppSettings> => ipcRenderer.invoke('patch-settings', patch),
	getSummary: (): Promise<unknown> => ipcRenderer.invoke('get-summary'),
	getDeviceInfo: (): Promise<unknown> => ipcRenderer.invoke('get-device-info'),
	getDeviceModel: (): Promise<DeviceModel> => ipcRenderer.invoke('get-device-model'),
	getDeviceProtocol: (): Promise<'X11' | 'R1'> => ipcRenderer.invoke('get-device-protocol'),
	getDeviceCapabilities: (): Promise<Record<string, boolean>> => ipcRenderer.invoke('get-device-capabilities'),
	getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('get-update-status'),
	checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('check-for-updates'),
	openReleasePage: (version?: string): Promise<boolean> => ipcRenderer.invoke('open-release-page', version),
	openProjectPage: (): Promise<boolean> => ipcRenderer.invoke('open-project-page'),
	getPlatformInfo: (): Promise<{ platform: string; portable: boolean; version: string }> =>
		ipcRenderer.invoke('get-platform-info'),
	onBatteryUpdated: (callback: (status: BatteryStatus) => void): (() => void) => {
		const listener = (_event: Electron.IpcRendererEvent, status: BatteryStatus): void => callback(status);
		ipcRenderer.on('battery-updated', listener);
		return () => ipcRenderer.removeListener('battery-updated', listener);
	},
	onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
		const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => callback(status);
		ipcRenderer.on('update-status', listener);
		return () => ipcRenderer.removeListener('update-status', listener);
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
