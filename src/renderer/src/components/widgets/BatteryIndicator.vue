<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
	defineProps<{
		level: number;
		connected: boolean;
	}>(),
	{ level: -1, connected: false },
);

const percent = computed(() => Math.max(0, Math.min(100, props.level)));
const isPlugged = computed(() => props.level < 0 && props.connected);

const batteryColor = computed(() => {
	if (percent.value <= 20) return 'bg-red-500';
	if (percent.value <= 50) return 'bg-yellow-500';
	return 'bg-green-500';
});

const glowColor = computed(() => {
	if (percent.value <= 20) return 'bg-red-500/20';
	return 'bg-transparent';
});
</script>

<template>
	<div class="flex items-center gap-2">
		<template v-if="connected && level >= 0">
			<!-- Animated battery -->
			<div class="relative w-10 h-5 border-2 border-[var(--sidebar-border)] rounded-md p-[2px]">
				<div
					class="h-full rounded-sm transition-all duration-700 ease-out"
					:class="batteryColor"
					:style="{ width: `${percent}%` }"
				/>
				<div
					class="absolute -right-[3px] top-[3px] w-[3px] h-[10px] bg-[var(--sidebar-border)] rounded-r-[2px]"
				/>
				<!-- Low battery glow -->
				<div v-if="level <= 20" class="absolute inset-0 rounded-sm animate-pulse" :class="glowColor" />
			</div>
			<span class="text-sm font-medium tabular-nums text-[var(--sidebar-text-footer)]">{{ level }}%</span>
		</template>
		<template v-else-if="connected">
			<!-- Wired mode icon -->
			<svg
				class="w-4 h-4 text-[var(--sidebar-text)]"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect x="4" y="2" width="16" height="20" rx="2" />
				<path d="M9 22v-4h6v4" />
				<path d="M8 12h8" />
				<path d="M10 9h4" />
				<path d="M9 5v2h6V5" />
			</svg>
			<span class="text-sm font-medium text-[var(--sidebar-text-footer)]">Wired</span>
		</template>
		<template v-else>
			<!-- Disconnected -->
			<div class="w-10 h-5 border-2 border-[var(--sidebar-text-muted)]/30 rounded-md p-[2px] opacity-30">
				<div class="h-full w-0 rounded-sm" />
			</div>
			<span class="text-xs text-[var(--sidebar-text-muted)] italic">Disconnected</span>
		</template>
	</div>
</template>
