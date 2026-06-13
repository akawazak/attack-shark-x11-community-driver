import { ref, type Ref } from 'vue';

export interface Toast {
	id: number;
	message: string;
	type: 'success' | 'error' | 'info';
}

const toasts = ref<Toast[]>([]) as Ref<Toast[]>;
let nextId = 0;

export function useToast(): {
	toasts: typeof toasts;
	addToast: (message: string, type: Toast['type'], duration?: number) => void;
	success: (message: string) => void;
	error: (message: string) => void;
	info: (message: string) => void;
	removeToast: (id: number) => void;
} {
	const addToast = (message: string, type: Toast['type'] = 'success', duration = 3000): void => {
		const id = nextId++;
		toasts.value = [...toasts.value, { id, message, type }];
		setTimeout(() => {
			toasts.value = toasts.value.filter((t) => t.id !== id);
		}, duration);
	};

	const success = (message: string): void => addToast(message, 'success');
	const error = (message: string): void => addToast(message, 'error');
	const info = (message: string): void => addToast(message, 'info');

	const removeToast = (id: number): void => {
		toasts.value = toasts.value.filter((t) => t.id !== id);
	};

	return { toasts, addToast, success, error, info, removeToast };
}
