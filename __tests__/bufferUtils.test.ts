import { describe, expect, it } from 'bun:test';
import { bufferStartsWith } from '../src/main/driver/utils/bufferUtils.js';

describe('bufferStartsWith', () => {
	it('should return true when buffer starts with the search string', () => {
		const buffer = Buffer.from([0x03, 0x55, 0x40, 0x01, 0x4b]);
		expect(bufferStartsWith(buffer, Buffer.from([0x03, 0x55, 0x40, 0x01]))).toBe(true);
	});

	it('should return false when buffer does not start with the search string', () => {
		const buffer = Buffer.from([0x01, 0x02, 0x03]);
		expect(bufferStartsWith(buffer, Buffer.from([0x04, 0x05]))).toBe(false);
	});

	it('should return false when search string is longer than buffer', () => {
		const buffer = Buffer.from([0x01]);
		expect(bufferStartsWith(buffer, Buffer.from([0x01, 0x02]))).toBe(false);
	});

	it('should accept string as search parameter', () => {
		const buffer = Buffer.from('hello world');
		expect(bufferStartsWith(buffer, 'hello')).toBe(true);
		expect(bufferStartsWith(buffer, 'world')).toBe(false);
	});

	it('should use the position offset', () => {
		const buffer = Buffer.from('hello world');
		expect(bufferStartsWith(buffer, 'world', 6)).toBe(true);
		expect(bufferStartsWith(buffer, 'hello', 6)).toBe(false);
	});

	it('should return false for negative position', () => {
		const buffer = Buffer.from('test');
		expect(bufferStartsWith(buffer, 'test', -1)).toBe(false);
	});

	it('should return false when position exceeds buffer length', () => {
		const buffer = Buffer.from('test');
		expect(bufferStartsWith(buffer, 't', 10)).toBe(false);
	});
});
