export { AttackSharkX11 } from './core/AttackSharkX11.js';
export { AttackSharkR1 } from './core/AttackSharkR1.js';
export type { BaseProtocolBuilder } from './core/BaseProtocolBuilder.js';
export { CustomMacroBuilder, MouseMacroEvent } from './protocols/CustomMacroBuilder.js';
export { CUSTOM_MACRO_BUTTONS, MacroMode } from '../../shared/macro-types.js';
export type { CustomMacroBuilderOptions } from './protocols/CustomMacroBuilder.js';
export { DpiBuilder } from './protocols/DpiBuilder.js';
export type { DpiBuilderOptions, StageIndex } from './protocols/DpiBuilder.js';
export { R1DpiBuilder } from './protocols/R1DpiBuilder.js';
export type { R1DpiBuilderOptions } from './protocols/R1DpiBuilder.js';
export { MacrosBuilder } from './protocols/MacrosBuilder.js';
export type { MacroBuilderOptions } from './protocols/MacrosBuilder.js';
export { FirmwareAction, KeyCode, MacroName, Modifiers, macroTemplates } from './protocols/MacrosBuilder.js';
export type { MacroTuple } from './protocols/MacrosBuilder.js';
export { PollingRateBuilder, Rate } from './protocols/PollingRateBuilder.js';
export type { PollingRateBuilderOptions } from './protocols/PollingRateBuilder.js';
export { R1PollingRateBuilder, R1Rate } from './protocols/R1PollingRateBuilder.js';
export type { R1PollingRateBuilderOptions } from './protocols/R1PollingRateBuilder.js';
export { UserPreferencesBuilder, LightMode } from './protocols/UserPreferencesBuilder.js';
export type {
	UserPreferencesBuilderOptions,
	LedSpeed,
	KeyResponse,
	DeepSleepTime,
	SleepTime,
	RGB,
} from './protocols/UserPreferencesBuilder.js';
export { R1UserPreferencesBuilder } from './protocols/R1UserPreferencesBuilder.js';
export type { R1UserPreferencesBuilderOptions } from './protocols/R1UserPreferencesBuilder.js';
export { ConnectionMode, Button } from './types.js';
export type {
	ControlTransferIn,
	ControlTransferOut,
	ControlTransferOptions,
	Logger,
	LogLevel,
	DeviceModel,
} from './types.js';
export { delay } from './utils/delay.js';
export { ConsoleLogger, logger } from './logger/index.js';
export { DriverError, ParamsError, DeviceError, InterfaceError, TimeoutError } from './errors.js';
