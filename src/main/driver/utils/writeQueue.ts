import { delay } from './delay.js';

/** Serializes state-changing reports so the mouse never receives overlapping writes. */
export class WriteQueue {
	private tail: Promise<void> = Promise.resolve();

	run<T>(write: () => Promise<T>, delayMs: number): Promise<T> {
		const result = this.tail.then(async () => {
			try {
				return await write();
			} finally {
				if (delayMs > 0) await delay(delayMs);
			}
		});
		this.tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}
}
