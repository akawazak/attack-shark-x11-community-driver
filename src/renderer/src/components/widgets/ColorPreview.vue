<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
	r: number;
	g: number;
	b: number;
}>();

const colorString = computed(() => `rgb(${props.r}, ${props.g}, ${props.b})`);
const isDark = computed(() => props.r * 0.299 + props.g * 0.587 + props.b * 0.114 < 128);
</script>

<template>
	<div
		class="relative w-10 h-10 rounded-full flex-shrink-0 transition-all duration-500"
		:style="{
			backgroundColor: colorString,
			boxShadow: `0 0 20px ${colorString}66, 0 0 40px ${colorString}33`,
		}"
	>
		<div class="absolute inset-1 rounded-full border" :class="isDark ? 'border-white/20' : 'border-black/10'" />
	</div>
</template>
