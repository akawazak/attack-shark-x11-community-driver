export function useLatestTask<T>(task: (value: T) => Promise<void>, onError: (error: unknown) => void = console.error) {
	let running = false;
	let pending: T | undefined;

	const drain = async (): Promise<void> => {
		running = true;
		try {
			while (pending !== undefined) {
				const next = pending;
				pending = undefined;
				try {
					await task(next);
				} catch (error) {
					onError(error);
				}
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
