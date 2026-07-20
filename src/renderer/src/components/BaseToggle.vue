<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
const props = withDefaults(
	defineProps<{
		label?: string;
		description?: string;
	}>(),
	{ label: '', description: '' },
);
</script>

<template>
	<div class="flex items-center justify-between gap-4">
		<div v-if="label" class="min-w-0">
			<div class="font-medium text-[var(--text-primary)]">{{ label }}</div>
			<div v-if="description" class="text-xs text-[var(--text-primary)] opacity-50">
				{{ description }}
			</div>
		</div>
		<button
			type="button"
			role="switch"
			:aria-checked="model"
			@click="model = !model"
			:class="[
				'relative w-12 h-6 rounded-full p-1 flex-shrink-0',
				model ? 'bg-shark-primary' : 'bg-[var(--border-card)]',
			]"
		>
			<div :class="['w-4 h-4 bg-white rounded-full shadow-md', model ? 'translate-x-6' : 'translate-x-0']" />
		</button>
	</div>
</template>
