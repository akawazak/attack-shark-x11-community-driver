<template>
	<div v-if="label" class="flex flex-col gap-1 w-full">
		<label class="text-xs text-[var(--text-primary)] opacity-60 uppercase tracking-wider font-semibold">
			{{ label }}
		</label>
		<input
			class="w-full h-[46px] bg-[var(--border-card)]/20 border border-transparent focus:border-[var(--shark-primary)] focus:bg-[var(--border-card)]/40 rounded-lg p-3"
			v-bind="$attrs"
			:value="modelValue"
			@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
		/>
	</div>
	<input
		v-else
		class="w-full h-[46px] bg-[var(--border-card)]/20 border border-transparent focus:border-[var(--shark-primary)] focus:bg-[var(--border-card)]/40 rounded-lg p-3"
		v-bind="$attrs"
		:value="modelValue"
		@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
	/>
</template>

<script setup lang="ts">
defineProps<{
	modelValue: string | number;
	label?: string;
}>();

defineEmits(['update:modelValue']);
</script>
