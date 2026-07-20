<template>
	<select
		class="w-full bg-[var(--border-card)]/50 border border-transparent hover:bg-[var(--border-card)]/80 focus:border-[var(--shark-primary)] focus:bg-[var(--border-card)]/100 rounded-lg p-3"
		v-bind="$attrs"
		:value="modelValue"
		@change="onChange"
	>
		<slot />
	</select>
</template>

<script setup lang="ts">
const props = defineProps<{
	modelValue: string | number;
}>();

const emit = defineEmits(['update:modelValue']);

const onChange = (e: Event) => {
	const raw = (e.target as HTMLSelectElement).value;
	if (typeof props.modelValue === 'number') {
		emit('update:modelValue', Number(raw));
	} else {
		emit('update:modelValue', raw);
	}
};
</script>
