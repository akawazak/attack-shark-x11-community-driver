<template>
	<button
		:class="[
			'rounded-lg px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed',
			variant === 'green'
				? 'bg-green-600 hover:bg-green-700 text-white'
				: variant === 'red'
					? 'bg-red-600 hover:bg-red-700 text-white'
					: 'bg-transparent border border-[var(--border-card)] text-[var(--text-primary)] hover:bg-[var(--border-card)]/50 hover:border-transparent',
		]"
		v-bind="$attrs"
	>
		<slot />
	</button>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		variant?: 'minimal' | 'green' | 'red';
	}>(),
	{
		variant: 'minimal',
	},
);
</script>
