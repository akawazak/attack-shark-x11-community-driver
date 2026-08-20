import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rendererRoot = join(process.cwd(), 'src', 'renderer', 'src');

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.(?:css|ts|vue)$/.test(entry.name) ? [path] : [];
	});
}

describe('renderer responsiveness', () => {
	it('contains no timed transitions or UI debouncers', () => {
		for (const file of sourceFiles(rendererRoot)) {
			const source = readFileSync(file, 'utf8');
			expect(source, file).not.toMatch(/\btransition-(?:all|colors)\b/);
			expect(source, file).not.toMatch(/\bduration-\d+\b/);
			expect(source, file).not.toMatch(/<Transition(?:Group)?\b/);
			expect(source, file).not.toMatch(/(?:^|\n)\s*transition\s*:/);
			expect(source, file).not.toContain('useDebounce');
		}
	});

	it('auto-connects detected hardware without a model-picker step', () => {
		const appSource = readFileSync(join(rendererRoot, 'App.vue'), 'utf8');
		expect(appSource).toContain('model: modelForDetectedDevice(preferred)');
		expect(appSource).toContain('selectPreferredDetectedDevice');
		expect(appSource).toContain('await refreshDeviceTopology()');
		expect(appSource).not.toContain("$t('connection.deviceModel')");
		expect(appSource).not.toContain('modelChoices');
	});

	it('keeps project support optional and non-blocking', () => {
		const appSource = readFileSync(join(rendererRoot, 'App.vue'), 'utf8');
		const supportSource = readFileSync(join(rendererRoot, 'components', 'ProjectSupport.vue'), 'utf8');
		expect(appSource).toContain('<ProjectSupport />');
		expect(supportSource).toContain('window.api.openProjectPage()');
		expect(supportSource).not.toMatch(/dialog|modal|setTimeout|localStorage/i);
	});
});
