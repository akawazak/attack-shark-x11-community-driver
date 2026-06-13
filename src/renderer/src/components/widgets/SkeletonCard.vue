<script setup lang="ts">
withDefaults(
	defineProps<{
		lines?: number;
		title?: boolean;
	}>(),
	{ lines: 3, title: true },
);
</script>

<template>
	<div
		class="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-card)] animate-pulse space-y-4"
	>
		<div v-if="title" class="h-5 bg-[var(--border-card)] rounded w-1/3" />
		<div v-for="i in lines" :key="i" class="space-y-3">
			<div
				class="h-4 bg-[var(--border-card)] rounded"
				:style="{ width: `${70 - i * 10}%` }"
			/>
		</div>
	</div>
</template>
