import type { Logger } from '../types.js';

export const logger: Logger = {
	debug: (m, c) => console.debug({ time: new Date().toISOString(), level: 'debug', message: m, context: c }),
	info: (m, c) => console.info({ time: new Date().toISOString(), level: 'info', message: m, context: c }),
	warn: (m, c) => console.warn({ time: new Date().toISOString(), level: 'warn', message: m, context: c }),
	error: (m, c) => console.error({ time: new Date().toISOString(), level: 'error', message: m, context: c }),
};
