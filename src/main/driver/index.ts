export { AttackSharkX11 } from './core/AttackSharkX11.js';
export type { BaseProtocolBuilder } from './core/BaseProtocolBuilder.js';
export {
	CustomMacroBuilder,
	CUSTOM_MACRO_BUTTONS,
	MacroMode,
	MouseMacroEvent,
} from './protocols/CustomMacroBuilder.js';
export type { CustomMacroBuilderOptions } from './protocols/CustomMacroBuilder.js';
export { DpiBuilder } from './protocols/DpiBuilder.js';
export type { DpiBuilderOptions, StageIndex } from './protocols/DpiBuilder.js';
export { MacrosBuilder } from './protocols/MacrosBuilder.js';
export type { MacroBuilderOptions } from './protocols/MacrosBuilder.js';
export { FirmwareAction, KeyCode, MacroName, Modifiers, macroTemplates } from './protocols/MacrosBuilder.js';
export type { MacroTuple } from './protocols/MacrosBuilder.js';
export { PollingRateBuilder, Rate } from './protocols/PollingRateBuilder.js';
export type { PollingRateBuilderOptions } from './protocols/PollingRateBuilder.js';
export { UserPreferencesBuilder, LightMode } from './protocols/UserPreferencesBuilder.js';
export type {
	UserPreferencesBuilderOptions,
	LedSpeed,
	KeyResponse,
	DeepSleepTime,
	SleepTime,
	RGB,
} from './protocols/UserPreferencesBuilder.js';
export { ConnectionMode, Button } from './types.js';
export type { ControlTransferIn, ControlTransferOut, ControlTransferOptions, Logger, LogLevel } from './types.js';
export { delay } from './utils/delay.js';
export { ConsoleLogger, logger } from './logger/index.js';
export {
	DriverError,
	ParamsError,
	DeviceError,
	InterfaceError,
	TransferError,
	ControlTransferError,
	TimeoutError,
} from './errors.js';
