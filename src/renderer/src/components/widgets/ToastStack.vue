<script setup lang="ts">
defineProps<{
	toasts: Array<{ id: number; message: string; type: string }>;
}>();

const emit = defineEmits<{
	remove: [id: number];
}>();
</script>

<template>
	<div
		class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
		style="max-width: 360px"
	>
		<TransitionGroup name="toast">
			<div
				v-for="toast in toasts"
				:key="toast.id"
				class="pointer-events-auto px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-sm cursor-pointer"
				:class="{
					'bg-green-600/90 text-white': toast.type === 'success',
					'bg-red-600/90 text-white': toast.type === 'error',
					'bg-blue-600/90 text-white': toast.type === 'info',
				}"
				@click="emit('remove', toast.id)"
			>
				<svg
					v-if="toast.type === 'success'"
					class="w-5 h-5 flex-shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="m9 12 2 2 4-4" />
				</svg>
				<svg
					v-else-if="toast.type === 'error'"
					class="w-5 h-5 flex-shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="m15 9-6 6m0-6 6 6" />
				</svg>
				<svg
					v-else
					class="w-5 h-5 flex-shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M12 16v-4m0-4h.01" />
				</svg>
				<span class="text-sm font-medium">{{ toast.message }}</span>
			</div>
		</TransitionGroup>
	</div>
</template>

<style scoped>
.toast-enter-active {
	transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-leave-active {
	transition: all 0.25s ease-in;
}
.toast-enter-from {
	opacity: 0;
	transform: translateX(100%) scale(0.9);
}
.toast-leave-to {
	opacity: 0;
	transform: translateX(100%) scale(0.9);
}
</style>
