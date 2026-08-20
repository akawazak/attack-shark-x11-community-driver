import { describe, expect, it } from 'bun:test';
import { useLatestTask } from '../src/renderer/src/composables/useLatestTask';

describe('useLatestTask', () => {
	it('runs immediately and collapses pending work to the newest value', async () => {
		const values: number[] = [];
		let releaseFirst!: () => void;
		const schedule = useLatestTask(async (value: number) => {
			values.push(value);
			if (value === 1) await new Promise<void>((resolve) => (releaseFirst = resolve));
		});

		schedule(1);
		schedule(2);
		schedule(3);
		expect(values).toEqual([1]);

		releaseFirst();
		await Promise.resolve();
		await Promise.resolve();
		expect(values).toEqual([1, 3]);
	});

	it('reports a failed task and continues with the newest pending value', async () => {
		const values: number[] = [];
		const errors: unknown[] = [];
		const schedule = useLatestTask(
			(value: number) => {
				if (value === 1) return Promise.reject(new Error('storage unavailable'));
				values.push(value);
				return Promise.resolve();
			},
			(error) => errors.push(error),
		);

		schedule(1);
		schedule(2);
		await Promise.resolve();
		await Promise.resolve();

		expect(errors).toHaveLength(1);
		expect(values).toEqual([2]);
	});
});
