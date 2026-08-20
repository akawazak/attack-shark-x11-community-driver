<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ExternalLink, RefreshCw } from 'lucide-vue-next';
import type { UpdateStatus } from '../../../shared/app-types.js';
import BaseButton from './BaseButton.vue';
import Card from './Card.vue';

const status = ref<UpdateStatus>({ state: 'idle', currentVersion: '0.0.0' });
let removeListener: (() => void) | null = null;

const isChecking = computed(() => status.value.state === 'checking');
const hasUpdate = computed(() => status.value.state === 'available' && Boolean(status.value.availableVersion));

const refresh = async () => {
	status.value = await window.api.checkForUpdates();
};

const openRelease = async () => {
	await window.api.openReleasePage(status.value.availableVersion);
};

onMounted(async () => {
	removeListener = window.api.onUpdateStatus((nextStatus) => {
		status.value = nextStatus;
	});
	status.value = await window.api.getUpdateStatus();
});

onUnmounted(() => removeListener?.());
</script>

<template>
	<Card>
		<template #title>
			<RefreshCw class="w-5 h-5 text-shark-primary" />
			{{ $t('updates.title') }}
		</template>
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="font-medium text-[var(--text-primary)]">
					<template v-if="hasUpdate">
						{{ $t('updates.available', { version: status.availableVersion }) }}
					</template>
					<template v-else-if="status.state === 'up-to-date'">{{ $t('updates.current') }}</template>
					<template v-else-if="status.state === 'error'">{{ $t('updates.failed') }}</template>
					<template v-else>{{ $t('updates.ready') }}</template>
				</p>
				<p class="text-xs text-[var(--text-muted)] mt-1">
					{{ $t('updates.safeDownload') }}
				</p>
			</div>
			<div class="flex gap-2">
				<BaseButton @click="refresh" :disabled="isChecking">
					<RefreshCw class="w-4 h-4" :class="isChecking ? 'animate-spin' : ''" />
					{{ isChecking ? $t('updates.checking') : $t('updates.check') }}
				</BaseButton>
				<BaseButton v-if="hasUpdate" @click="openRelease" variant="green">
					<ExternalLink class="w-4 h-4" />
					{{ $t('updates.download') }}
				</BaseButton>
			</div>
		</div>
	</Card>
</template>
