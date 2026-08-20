export function isDeviceMissingError(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		normalized.includes('not found') ||
		normalized.includes('no such device') ||
		normalized.includes('libusb_error_no_device')
	);
}

export function selectConnectionError(errors: readonly string[]): string {
	const meaningfulErrors = errors.map((error) => error.trim()).filter(Boolean);
	return meaningfulErrors.find((error) => !isDeviceMissingError(error)) ?? meaningfulErrors[0] ?? 'Unknown error';
}
