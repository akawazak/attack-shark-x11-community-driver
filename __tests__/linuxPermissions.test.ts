import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('Linux device permissions', () => {
	it('never installs world-writable or plugdev-dependent rules', () => {
		const permissionSources = [
			'assets/70-attack-shark-x11.rules',
			'install.sh',
			'scripts/deb-after-install.sh',
			'PKGBUILD',
		].map(read);

		for (const source of permissionSources) {
			expect(source).not.toContain('MODE="0666"');
			expect(source).not.toContain('GROUP="plugdev"');
		}
		expect(read('assets/70-attack-shark-x11.rules')).toContain('MODE="0660", TAG+="uaccess"');
	});

	it('removes only the exact unsafe legacy rule on every packaged upgrade path', () => {
		const legacyRule = '/etc/udev/rules.d/99-attack-shark-x11-electron.rules';
		expect(read('install.sh')).toContain(legacyRule);
		expect(read('scripts/deb-after-install.sh')).toContain(legacyRule);
		expect(read('attack-shark-x11-electron.install')).toContain(legacyRule);
		expect(read('PKGBUILD')).toContain('install=attack-shark-x11-electron.install');
		expect(read('.SRCINFO')).toContain('install = attack-shark-x11-electron.install');
		expect(read('.github/workflows/aur-release.yml')).toContain(
			'cp "$GITHUB_WORKSPACE/attack-shark-x11-electron.install" attack-shark-x11-electron.install',
		);
	});

	it('offers group access only through an explicit restricted opt-in', () => {
		const installer = read('install.sh');
		expect(installer).toContain('--group-access');
		expect(installer).toContain('MODE="0660", GROUP="attackshark"');
		expect(installer).toContain('usermod --append --groups');
		expect(installer).not.toContain('usermod -aG usbmice');
	});
});
