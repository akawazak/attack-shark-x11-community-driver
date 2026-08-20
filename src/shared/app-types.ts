export type DeviceModel = 'X11' | 'X11SE' | 'R1' | 'VXE_R1_SE_PLUS';

export type DeviceProtocol = 'X11' | 'R1';

export type ConnectionModeName = 'Adapter' | 'Wired';

export interface DeviceCapabilities {
	dpi: boolean;
	pollingRate: boolean;
	battery: boolean;
	rgb: boolean;
	macros: boolean;
	buttonRemap: boolean;
	lightMode: boolean;
	ledSpeed: boolean;
	sleepTime: boolean;
	deepSleepTime: boolean;
	keyResponse: boolean;
	rippleControl: boolean;
	angleSnap: boolean;
}

export interface DetectedDevice {
	id: string;
	vendorId: number;
	productId: number;
	connectionMode: ConnectionModeName;
	protocol: DeviceProtocol;
	manufacturer: string | null;
	product: string | null;
	serialNumber: string | null;
	compatibleModels: DeviceModel[];
	ambiguous: boolean;
}

export interface DeviceDetectionResult {
	detected: boolean;
	devices: DetectedDevice[];
}

export interface BatteryStatus {
	level: number;
	state: 'initializing' | 'stable' | 'stale' | 'unavailable';
	updatedAt: number | null;
	sampleCount: number;
	rejectedCount: number;
}

export interface BatteryDiagnosticSample {
	timestamp: number;
	value: number | null;
	accepted: boolean;
	reason: string;
	reportHex: string;
}

export interface BatteryDiagnostics {
	status: BatteryStatus;
	samples: BatteryDiagnosticSample[];
}

export interface UpdateStatus {
	state: 'unsupported' | 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error';
	currentVersion: string;
	availableVersion?: string;
	progress?: number;
	message?: string;
}

export interface AppSettings {
	lastTab: 'overview' | 'preferences' | 'dpi' | 'macros' | 'device-info';
	connectionMode: ConnectionModeName;
	deviceModel: DeviceModel;
	language: 'en' | 'es';
	theme: 'dark' | 'light' | 'cappuccino';
	preferences: {
		lightMode: number;
		ledSpeed: number;
		keyResponse: number;
		pollingRate: number;
		sleepTime: number;
		deepSleepTime: number;
		rgb: { r: number; g: number; b: number };
	};
	dpiConfig: {
		activeStage: 1 | 2 | 3 | 4 | 5 | 6;
		angleSnap: boolean;
		ripplerControl: boolean;
		dpiValues: [number, number, number, number, number, number];
	};
}

export type AppSettingsPatch = {
	[K in keyof AppSettings]?: AppSettings[K] extends Record<string, unknown>
		? Partial<AppSettings[K]>
		: AppSettings[K];
};
