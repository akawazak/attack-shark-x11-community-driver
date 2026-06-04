# Changelog

## [1.2.1] - 2026-06-04

### Refactored
- Extracted macro enums, key codes, and templates to `src/shared/macro-templates.ts` for reuse between main and renderer processes
- Refactored driver barrel exports from wildcard re-exports to explicit named exports

### Improved
- `AsyncLock` now uses queue-based waiting instead of busy-spin (`setTimeout` loop), reducing CPU overhead
- `CustomMacroBuilder` delay encoding now clamps values to max 51000ms and caps extra delay units at 255
- Device summary parsing now validates response length and safely defaults missing fields

### Removed
- Bluetooth connection mode option (unsupported hardware)
- Unused `getPreferences` IPC handler and corresponding preload binding
- `GEMINI.md` and `PATCH_NOTE.md` documentation files

### Fixed
- `MacroSettings.vue` import path updated to use shared macro templates module
- `env.d.ts` type definitions aligned with removed Bluetooth mode and IPC methods
- Wired mode control transfer `wValue` formatting (Prettier normalization)
- DPI map table now includes explanatory comment for high-value encoding

### Chores
- Added `test` script (`bun test`) to package.json
- Updated `PKGBUILD` for release packaging
- Formatted all source files with Prettier
- Linted with ESLint (auto-fix applied)
