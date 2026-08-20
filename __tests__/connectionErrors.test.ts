import { describe, expect, it } from 'bun:test';
import { isDeviceMissingError, selectConnectionError } from '../src/shared/connection-errors';

describe('connection errors', () => {
	it('keeps the permission failure instead of replacing it with the R1 fallback miss', () => {
		expect(
			selectConnectionError([
				'Could not claim interface 2: LIBUSB_ERROR_ACCESS',
				'Device with idProduct 64097 not found',
			]),
		).toBe('Could not claim interface 2: LIBUSB_ERROR_ACCESS');
	});

	it('reports the first attempted wired product when neither known device exists', () => {
		expect(
			selectConnectionError(['Device with idProduct 64085 not found', 'Device with idProduct 64097 not found']),
		).toBe('Device with idProduct 64085 not found');
	});

	it('does not classify every libusb error as a missing device', () => {
		expect(isDeviceMissingError('LIBUSB_ERROR_NO_DEVICE')).toBe(true);
		expect(isDeviceMissingError('LIBUSB_ERROR_ACCESS')).toBe(false);
	});
});
