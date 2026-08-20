const REPOSITORY_PATH = '/akawazak/attack-shark-x11-community-driver';

export function isAllowedExternalUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return (
			url.protocol === 'https:' &&
			url.hostname === 'github.com' &&
			url.port === '' &&
			url.username === '' &&
			url.password === '' &&
			(url.pathname === REPOSITORY_PATH || url.pathname.startsWith(`${REPOSITORY_PATH}/`))
		);
	} catch {
		return false;
	}
}

export function parseVersion(value: string): [number, number, number] | null {
	const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function isNewerVersion(candidate: string, current: string): boolean {
	const next = parseVersion(candidate);
	const installed = parseVersion(current);
	if (!next || !installed) return false;
	for (let index = 0; index < next.length; index++) {
		if ((next[index] ?? 0) !== (installed[index] ?? 0)) return (next[index] ?? 0) > (installed[index] ?? 0);
	}
	return false;
}
