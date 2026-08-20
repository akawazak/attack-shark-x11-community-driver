/// <reference types="vite/client" />

import type {
	AppSettings,
	AppSettingsPatch,
	BatteryDiagnostics,
	BatteryStatus,
	DeviceDetectionResult,
	DeviceModel,
	UpdateStatus,
} from '../../shared/app-types.js';

declare module '@vue/runtime-core' {
	interface ComponentCustomProperties {
		$t: (key: string, ...args: unknown[]) => string;
	}
}

declare global {
	interface Window {
		api: {
			detectDevice: () => Promise<DeviceDetectionResult>;
			connectDevice: (params: {
				model: DeviceModel;
				mode: number;
			}) => Promise<{ success: boolean; error?: string }>;
			disconnectDevice: () => Promise<void>;
			getBatteryStatus: () => Promise<BatteryStatus>;
			getBatteryDiagnostics: () => Promise<BatteryDiagnostics | null>;
			setDpi: (config: unknown) => Promise<number>;
			getDpi: () => Promise<Buffer>;
			resetDevice: () => Promise<{ success: boolean }>;
			setPollingRate: (rate: number) => Promise<number>;
			setUserPreferences: (prefs: unknown) => Promise<number>;
			setMacro: (config: unknown) => Promise<number>;
			sendCustomMacro: (packets: unknown) => Promise<void>;
			listProfiles: () => Promise<string[]>;
			saveProfile: (name: string, data: unknown) => Promise<void>;
			loadProfile: (name: string) => Promise<unknown>;
			deleteProfile: (name: string) => Promise<void>;
			getSettings: () => Promise<AppSettings>;
			patchSettings: (patch: AppSettingsPatch) => Promise<AppSettings>;
			getSummary: () => Promise<unknown>;
			getDeviceInfo: () => Promise<unknown>;
			getDeviceModel: () => Promise<DeviceModel>;
			getDeviceProtocol: () => Promise<'X11' | 'R1'>;
			getDeviceCapabilities: () => Promise<Record<string, boolean>>;
			getUpdateStatus: () => Promise<UpdateStatus>;
			checkForUpdates: () => Promise<UpdateStatus>;
			openReleasePage: (version?: string) => Promise<boolean>;
			openProjectPage: () => Promise<boolean>;
			getPlatformInfo: () => Promise<{ platform: string; portable: boolean; version: string }>;
			onBatteryUpdated: (callback: (status: BatteryStatus) => void) => () => void;
			onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
		};
	}
}

export {};
