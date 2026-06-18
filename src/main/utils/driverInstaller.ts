import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export interface DriverInstallResult {
	success: boolean;
	alreadyInstalled: boolean;
	output: string;
	error?: string;
}

const INF_NAME = 'attack-shark-x11-winusb.inf';

/**
 * Locate the bundled WinUSB INF. Tries:
 *  - production:  process.resourcesPath/drivers/<name>
 *  - dev:         walk up from this file's __dirname to find a `drivers/` folder
 *  - fallback:    process.cwd()/drivers/<name>
 */
export function resolveDriverInfPath(): string {
	const candidates: string[] = [];

	if (process.resourcesPath) {
		candidates.push(join(process.resourcesPath, 'drivers', INF_NAME));
	}

	// Walk up from this file's location (works in both CJS and ESM since we
	// rely on the global __dirname provided by electron-vite's CJS output).
	if (typeof __dirname === 'string') {
		let cursor = __dirname;
		for (let i = 0; i < 6; i++) {
			candidates.push(join(cursor, 'drivers', INF_NAME));
			const parent = dirname(cursor);
			if (parent === cursor) break;
			cursor = parent;
		}
	}

	candidates.push(resolve(process.cwd(), 'drivers', INF_NAME));

	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}

	return candidates[0] ?? join(process.cwd(), 'drivers', INF_NAME);
}

/**
 * Run `pnputil /add-driver <inf> /install` elevated.
 *
 * On Windows this triggers a UAC prompt; the user must accept before the
 * driver is installed. Uses PowerShell `Start-Process -Verb RunAs` to
 * self-elevate so the main process itself doesn't need to be elevated.
 *
 * Returns a result object even on failure so the UI can show the actual
 * pnputil error (e.g. "driver is already installed" is not really an error).
 */
export function installUsbDriver(): Promise<DriverInstallResult> {
	if (process.platform !== 'win32') {
		return Promise.resolve({
			success: false,
			alreadyInstalled: false,
			output: '',
			error: 'USB driver installation is only available on Windows. On Linux, configure udev rules instead.',
		});
	}

	const infPath = resolveDriverInfPath();
	if (!existsSync(infPath)) {
		return Promise.resolve({
			success: false,
			alreadyInstalled: false,
			output: '',
			error: `Driver INF not found at: ${infPath}. Make sure the app was installed correctly.`,
		});
	}

	const tempInfPath = join(tmpdir(), INF_NAME);
	try {
		mkdirSync(tmpdir(), { recursive: true });
		copyFileSync(infPath, tempInfPath);
	} catch (error: unknown) {
		const err = error instanceof Error ? error : new Error(String(error));
		return Promise.resolve({
			success: false,
			alreadyInstalled: false,
			output: '',
			error: `Could not stage driver INF for installation: ${err.message}`,
		});
	}

	// PowerShell script that:
	//   1. re-launches pnputil.exe with /add-driver /install,
	//   2. via Start-Process -Verb RunAs (triggers the UAC dialog),
	//   3. waits and forwards its stdout/stderr back to us.
	const quotedInfPath = `"${tempInfPath.replace(/"/g, '\\"')}"`;
	const psScript = `
$p = Start-Process -FilePath 'pnputil.exe' -ArgumentList @('/add-driver','${escapeForPs(quotedInfPath)}','/install') -Verb RunAs -Wait -PassThru;
Write-Output ('PnputilExitCode=' + $p.ExitCode);
`.trim();

	return new Promise<DriverInstallResult>((resolveResult) => {
		const proc = spawn(
			'powershell.exe',
			['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
			{ windowsHide: true },
		);

		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf8');
		});
		proc.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString('utf8');
		});

		proc.on('error', (err) => {
			resolveResult({
				success: false,
				alreadyInstalled: false,
				output: stdout,
				error: `Failed to launch PowerShell: ${err.message}`,
			});
		});

		proc.on('close', (psCode) => {
			// PowerShell itself returning non-zero usually means UAC was
			// declined (e.g. 1223) or powershell.exe is missing.
			if (psCode !== 0) {
				resolveResult({
					success: false,
					alreadyInstalled: false,
					output: stdout,
					error: `PowerShell exited with code ${psCode}. ${stderr.trim() || 'UAC prompt was likely declined.'}`,
				});
				return;
			}

			// Extract pnputil's exit code from the sentinel line we wrote.
			const exitMatch = stdout.match(/PnputilExitCode=(\d+)/);
			const pnpExitCode = exitMatch && exitMatch[1] ? Number.parseInt(exitMatch[1], 10) : -1;

			if (pnpExitCode === 0) {
				resolveResult({
					success: true,
					alreadyInstalled: /already.*driver|already.*installed/i.test(stdout),
					output: stdout,
				});
				return;
			}

			resolveResult({
				success: false,
				alreadyInstalled: false,
				output: stdout,
				error: formatPnPUtilError(pnpExitCode, stdout, stderr),
			});
		});
	});
}

/**
 * Escape a path for embedding in a PowerShell single-quoted string.
 * Single quotes are escaped by doubling them; no other escaping is needed
 * for our use case.
 */
function escapeForPs(input: string): string {
	return input.replace(/'/g, "''");
}

function formatPnPUtilError(exitCode: number, stdout: string, stderr: string): string {
	const output = stdout.trim() || stderr.trim() || 'Unknown error.';
	if (/digital signature|signed|signature information/i.test(output)) {
		return (
			`pnputil failed with code ${exitCode}: Windows refused the bundled INF because it is not signed. ` +
			'This build still needs a signed driver package or a HID-native Windows backend. ' +
			output
		);
	}
	return `pnputil failed with code ${exitCode}. ${output}`;
}
