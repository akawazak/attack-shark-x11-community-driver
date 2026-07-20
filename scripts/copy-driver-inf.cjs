#!/usr/bin/env node
/* eslint-disable */
/**
 * Copy the WinUSB driver INF into the build output directory so that
 * `bun run dev` (and the runtime in general) can find it.
 *
 * In packaged builds the INF is bundled via electron-builder's
 * `extraResources` into `process.resourcesPath/drivers/`.
 * For dev / `electron-vite build` (which only emits to `out/`), we
 * also place a copy in `out/main/drivers/` so the `__dirname` walk-up
 * in `driverInstaller.resolveDriverInfPath` finds it.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'drivers', 'attack-shark-x11-winusb.inf');
const DEST_DIRS = [path.join(ROOT, 'out', 'main', 'drivers'), path.join(ROOT, 'out', 'drivers')];

if (!fs.existsSync(SRC)) {
	console.error(`[copy-driver-inf] Source INF not found: ${SRC}`);
	process.exit(0); // non-fatal: the runtime will show a clean error in the UI
}

for (const destDir of DEST_DIRS) {
	try {
		fs.mkdirSync(destDir, { recursive: true });
		const dest = path.join(destDir, 'attack-shark-x11-winusb.inf');
		fs.copyFileSync(SRC, dest);
		console.log(`[copy-driver-inf] copied -> ${dest}`);
	} catch (err) {
		console.warn(`[copy-driver-inf] could not write to ${destDir}: ${err.message}`);
	}
}
