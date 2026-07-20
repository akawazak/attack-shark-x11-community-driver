import { describe, expect, it } from 'bun:test';
import { WriteQueue } from '../src/main/driver/utils/writeQueue.js';

describe('WriteQueue', () => {
	it('keeps the event loop responsive during its cooldown', async () => {
		const queue = new WriteQueue();
		let cooldownFinished = false;
		const write = queue
			.run(() => Promise.resolve(1), 50)
			.then(() => {
				cooldownFinished = true;
			});

		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		expect(cooldownFinished).toBe(false);

		await write;
		expect(cooldownFinished).toBe(true);
	});

	it('serializes writes and stays usable after a failed write', async () => {
		const queue = new WriteQueue();
		const events: string[] = [];
		let releaseFirst!: () => void;
		const first = queue.run(
			() =>
				new Promise<number>((resolve) => {
					events.push('first-start');
					releaseFirst = (): void => {
						events.push('first-end');
						resolve(1);
					};
				}),
			0,
		);
		const failed = queue.run(() => {
			events.push('failed-start');
			return Promise.reject(new Error('write failed'));
		}, 0);
		const third = queue.run(() => {
			events.push('third-start');
			return Promise.resolve(3);
		}, 0);

		await Promise.resolve();
		expect(events).toEqual(['first-start']);
		releaseFirst();
		await expect(first).resolves.toBe(1);
		await expect(failed).rejects.toThrow('write failed');
		await expect(third).resolves.toBe(3);
		expect(events).toEqual(['first-start', 'first-end', 'failed-start', 'third-start']);
	});
});
