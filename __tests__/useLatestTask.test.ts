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
});
