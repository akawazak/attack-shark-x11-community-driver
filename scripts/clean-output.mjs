import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowedDirectories = new Set(['out', 'dist']);

for (const directory of process.argv.slice(2)) {
	if (!allowedDirectories.has(directory)) throw new Error(`Refusing to clean unexpected directory: ${directory}`);
	const target = resolve(projectRoot, directory);
	if (dirname(target) !== projectRoot) throw new Error(`Refusing to clean outside the project: ${target}`);
	rmSync(target, { recursive: true, force: true });
}
