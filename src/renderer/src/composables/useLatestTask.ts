export function useLatestTask<T>(task: (value: T) => Promise<void>) {
	let running = false;
	let pending: T | undefined;

	const drain = async (): Promise<void> => {
		running = true;
		try {
			while (pending !== undefined) {
				const next = pending;
				pending = undefined;
				await task(next);
			}
		} finally {
			running = false;
		}
	};

	return (value: T): void => {
		pending = value;
		if (!running) void drain();
	};
}
