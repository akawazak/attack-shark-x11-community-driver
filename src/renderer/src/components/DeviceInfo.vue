<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { HardDrive, Info } from 'lucide-vue-next';
import BaseButton from './BaseButton.vue';
import Card from './Card.vue';
import StatusMessage from './StatusMessage.vue';
import type { BatteryDiagnostics } from '../../../shared/app-types.js';

const { t } = useI18n();

const props = defineProps<{
	isConnected: boolean;
}>();

interface DeviceInfoData {
	manufacturer: string;
	product: string;
	serialNumber: string;
	vendorId: string;
	productId: string;
	bcdDevice: string;
	connectionMode: string;
	interfaces: number;
}

const deviceInfo = ref<DeviceInfoData | null>(null);
const batteryDiagnostics = ref<BatteryDiagnostics | null>(null);
const isLoading = ref(false);
const errorMessage = ref('');

const fetchDeviceInfo = async () => {
	if (!props.isConnected) return;
	isLoading.value = true;
	errorMessage.value = '';

	try {
		const [info, diagnostics] = await Promise.all([
			window.api.getDeviceInfo() as Promise<DeviceInfoData>,
			window.api.getBatteryDiagnostics(),
		]);
		deviceInfo.value = info;
		batteryDiagnostics.value = diagnostics;
	} catch (err: unknown) {
		const error = err instanceof Error ? err : new Error(String(err));
		errorMessage.value = `${t('deviceInfo.fetchError')}${error.message}`;
		console.error('Device info error:', error);
	} finally {
		isLoading.value = false;
	}
};

onMounted(() => {
	if (props.isConnected) {
		fetchDeviceInfo();
	}
});
</script>

<template>
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h2 class="text-3xl font-bold flex items-center gap-3 text-[var(--text-primary)]">
				<HardDrive class="w-8 h-8 text-shark-primary" />
				{{ $t('deviceInfo.title') }}
			</h2>
			<BaseButton @click="fetchDeviceInfo" :disabled="!isConnected || isLoading" variant="green">
				{{ isLoading ? $t('deviceInfo.loading') : $t('deviceInfo.refresh') }}
			</BaseButton>
		</div>

		<StatusMessage :message="errorMessage" type="error" />

		<!-- Device Info Display -->
		<div v-if="deviceInfo" class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Manufacturer & Product -->
			<Card>
				<template #title>
					<HardDrive class="w-5 h-5 text-shark-primary" />
					{{ $t('deviceInfo.deviceTitle') }}
				</template>
				<div class="space-y-4">
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.manufacturer') }}</p>
						<p class="text-lg font-medium text-[var(--text-primary)]">{{ deviceInfo.manufacturer }}</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.productName') }}</p>
						<p class="text-lg font-medium text-[var(--text-primary)]">{{ deviceInfo.product }}</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.connectionMode') }}</p>
						<p class="text-lg font-medium text-[var(--text-primary)]">{{ deviceInfo.connectionMode }}</p>
					</div>
				</div>
			</Card>

			<!-- USB & Firmware Details -->
			<Card>
				<template #title>
					{{ $t('deviceInfo.technicalDetails') }}
				</template>
				<div class="space-y-4">
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.vendorId') }}</p>
						<p class="text-lg font-medium text-[var(--text-primary)] font-mono">
							{{ deviceInfo.vendorId }}
						</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.productId') }}</p>
						<p class="text-lg font-medium text-[var(--text-primary)] font-mono">
							{{ deviceInfo.productId }}
						</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.deviceVersion') }}</p>
						<p class="text-lg font-medium text-[var(--text-primary)] font-mono">
							{{ deviceInfo.bcdDevice }}
						</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.interfaces') }}</p>
						<p class="text-lg font-medium text-[var(--text-primary)]">{{ deviceInfo.interfaces }}</p>
					</div>
				</div>
			</Card>

			<!-- Serial Number (spans both columns on larger screens) -->
			<Card class="md:col-span-2">
				<div class="flex items-start gap-3">
					<Info class="w-5 h-5 text-shark-primary flex-shrink-0 mt-1" />
					<div class="flex-1">
						<p class="text-xs text-[var(--text-tertiary)] mb-2 uppercase tracking-wide">
							{{ $t('deviceInfo.serialNumber') }}
						</p>
						<p class="text-lg font-medium text-[var(--text-primary)] font-mono break-all">
							{{ deviceInfo.serialNumber }}
						</p>
					</div>
				</div>
			</Card>

			<Card v-if="batteryDiagnostics" class="md:col-span-2">
				<template #title>{{ $t('deviceInfo.batteryDiagnostics') }}</template>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.batteryState') }}</p>
						<p class="font-medium text-[var(--text-primary)]">{{ batteryDiagnostics.status.state }}</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.batterySamples') }}</p>
						<p class="font-medium text-[var(--text-primary)]">
							{{ batteryDiagnostics.status.sampleCount }}
						</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.batteryFiltered') }}</p>
						<p class="font-medium text-[var(--text-primary)]">
							{{ batteryDiagnostics.status.rejectedCount }}
						</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">
							{{ $t('deviceInfo.batteryLastUpdated') }}
						</p>
						<p class="font-medium text-[var(--text-primary)]">
							{{
								batteryDiagnostics.status.updatedAt
									? new Date(batteryDiagnostics.status.updatedAt).toLocaleTimeString()
									: $t('deviceInfo.never')
							}}
						</p>
					</div>
					<div>
						<p class="text-xs text-[var(--text-tertiary)] mb-1">{{ $t('deviceInfo.batteryLastReport') }}</p>
						<p class="font-medium text-[var(--text-primary)] font-mono text-sm break-all">
							{{ batteryDiagnostics.samples.at(-1)?.reason ?? $t('deviceInfo.never') }}
						</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Empty State -->
		<div v-else-if="!isLoading" class="flex flex-col items-center justify-center py-12 text-center">
			<HardDrive class="w-12 h-12 text-[var(--text-tertiary)] mb-4 opacity-50" />
			<p class="text-[var(--text-tertiary)]">
				{{ isConnected ? $t('deviceInfo.refreshHint') : $t('deviceInfo.connectHint') }}
			</p>
		</div>

		<!-- Loading State -->
		<div v-else class="flex flex-col items-center justify-center py-12">
			<div
				class="w-8 h-8 border-2 border-shark-primary border-t-transparent rounded-full animate-spin mb-4"
			></div>
			<p class="text-[var(--text-tertiary)]">{{ $t('deviceInfo.loadingInfo') }}</p>
		</div>
	</div>
</template>

<style scoped>
@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.animate-spin {
	animation: spin 1s linear infinite;
}
</style>
