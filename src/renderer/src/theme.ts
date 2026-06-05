export const theme = {
	primary: 'var(--shark-primary)',
	primaryLight: 'var(--color-shark-primary-light)',
	primaryDark: 'var(--color-shark-primary-dark)',

	accent: 'var(--shark-accent)',
	accentLight: 'var(--color-shark-accent-light)',
	accentDark: 'var(--color-shark-accent-dark)',

	surface: {
		0: 'var(--bg-primary)',
		1: 'var(--bg-card)',
		2: 'var(--bg-elevated)',
		3: 'var(--color-shark-surface-3)',
	},

	text: {
		primary: 'var(--text-primary)',
		secondary: 'var(--text-secondary)',
		muted: 'var(--text-muted)',
	},

	border: {
		default: 'var(--border-color)',
		hover: 'var(--border-hover)',
	},

	semantic: {
		error: 'var(--color-shark-error)',
		errorLight: 'var(--color-shark-error-light)',
		warning: 'var(--color-shark-warning)',
		warningLight: 'var(--color-shark-warning-light)',
		success: 'var(--color-shark-success)',
		successLight: 'var(--color-shark-success-light)',
		info: 'var(--color-shark-info)',
		infoLight: 'var(--color-shark-info-light)',
	},

	shadow: 'var(--shadow-color)',
	focusRing: 'var(--focus-ring)',
} as const;

export type Theme = typeof theme;
