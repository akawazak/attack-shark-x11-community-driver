export class AsyncLock {
	private locked = false;
	private waiting: (() => void)[] = [];

	acquire(): Promise<void> {
		if (!this.locked) {
			this.locked = true;
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			this.waiting.push(resolve);
		});
	}

	release(): void {
		if (this.waiting.length > 0) {
			const next = this.waiting.shift();
			next?.();
		} else {
			this.locked = false;
		}
	}
}
