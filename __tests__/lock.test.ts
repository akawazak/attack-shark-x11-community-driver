import { describe, expect, it } from 'bun:test';
import { AsyncLock } from '../src/main/utils/lock.js';

describe('AsyncLock', () => {
	it('should acquire immediately when not locked', async () => {
		const lock = new AsyncLock();
		await lock.acquire();
		lock.release();
	});

	it('should queue waiters when locked', async () => {
		const lock = new AsyncLock();
		await lock.acquire();

		let secondRan = false;
		const second = lock.acquire().then(() => {
			secondRan = true;
		});

		// Second should not have resolved yet
		expect(secondRan).toBe(false);

		lock.release();
		await second;
		expect(secondRan).toBe(true);
	});

	it('should support multiple sequential acquisitions', async () => {
		const lock = new AsyncLock();
		const results: number[] = [];

		await lock.acquire();
		results.push(1);

		const p2 = lock.acquire().then(() => {
			results.push(2);
			lock.release();
		});

		const p3 = lock.acquire().then(() => {
			results.push(3);
			lock.release();
		});

		lock.release();
		await p2;
		await p3;

		expect(results).toEqual([1, 2, 3]);
	});

	it('should handle many concurrent acquisitions in order', async () => {
		const lock = new AsyncLock();
		const order: number[] = [];

		await lock.acquire();

		const promises = [1, 2, 3, 4, 5].map((i) =>
			lock.acquire().then(() => {
				order.push(i);
				lock.release();
			}),
		);

		lock.release();
		await Promise.all(promises);

		expect(order).toEqual([1, 2, 3, 4, 5]);
	});
});
