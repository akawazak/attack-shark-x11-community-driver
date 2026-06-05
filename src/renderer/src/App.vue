<script setup lang="ts">
import { ref, onMounted, reactive, watch, toRaw } from 'vue';
import { Settings, Zap, Info, ShieldAlert, Keyboard, Plug, MousePointer2 } from 'lucide-vue-next';

import UserPreferences from './components/UserPreferences.vue';
import DpiSettings from './components/DpiSettings.vue';
import MacroSettings from './components/MacroSettings.vue';
import DeviceInfo from './components/DeviceInfo.vue';
import LanguageSelector from './components/LanguageSelector.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import packageInfo from '../../../package.json';

const version = packageInfo.version;
const isConnected = ref(false);
const connectionMode = ref<'Adapter' | 'Wired' | null>(null);
const batteryLevel = ref(-1);
const preferences = ref({
	lightMode: 0x20, // Breathing
	ledSpeed: 2,
	keyResponse: 4,
	pollingRate: 1000,
	sleepTime: 2,
	deepSleepTime: 10,
	rgb: { r: 255, g: 0, b: 255 },
});
const deviceSummary = ref<{
	ledSpeed: number;
	lightMode: number;
	keyResponse: number;
	rgb: { r: number; g: number; b: number };
} | null>(null);
const profiles = ref<string[]>([]);
const connectionError = ref('');
const activeTab = ref('preferences');

const updateProfiles = async () => {
	profiles.value = await window.api.listProfiles();
};

const connect = async (mode: number) => {
	connectionError.value = '';
	try {
		if (!window.api) throw new Error('IPC API not found.');
		const result = await window.api.connectDevice(mode);
		if (result.success) {
			isConnected.value = true;
			connectionMode.value = mode === 0xfa55 ? 'Wired' : 'Adapter';
			if (connectionMode.value === 'Wired' && activeTab.value === 'preferences') {
				activeTab.value = 'dpi';
			}
			// Refresh battery explicitly after successful connection
			await updateBattery();
			await fetchSummary();
			await updateProfiles();
		} else {
			connectionError.value = result.error || 'Unknown error';
		}
	} catch (err: unknown) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.error('IPC Error:', error);
		connectionError.value = `Connection Error: ${error.message}`;
	}
};

const fetchSummary = async () => {
	try {
		const summary = await window.api.getSummary();
		deviceSummary.value = summary;
	} catch (err) {
		console.error('Failed to fetch summary:', err);
	}
};

const reset = async () => {
	if (!confirm('Are you sure you want to reset to factory defaults? This cannot be undone.')) return;
	try {
		await window.api.resetDevice();
		alert('Reset successful! Please reconnect the device.');
		isConnected.value = false;
	} catch (err: unknown) {
		const error = err instanceof Error ? err : new Error(String(err));
		alert(`Reset failed: ${error.message}`);
	}
};

const updateBattery = async () => {
	try {
		const level = await window.api.getBattery();
		batteryLevel.value = level;
	} catch (err) {
		console.warn('Battery update timed out or failed:', err);
		batteryLevel.value = -1;
	}
};

onMounted(async () => {
	window.api.onBatteryUpdated((level: number) => {
		batteryLevel.value = level;
	});

	const settings = await window.api.getSettings();
	if (settings) {
		if (settings.lastTab) activeTab.value = settings.lastTab;
		if (settings.connectionMode) connectionMode.value = settings.connectionMode;
		if (settings.theme) {
			localStorage.setItem('theme', settings.theme);
			document.documentElement.className = settings.theme === 'dark' ? '' : settings.theme;
		}
		if (settings.preferences) {
			Object.assign(preferences.value, settings.preferences);
		}
	}
});

watch(
	() => [activeTab.value, preferences.value, connectionMode.value],
	async () => {
		const settings = await window.api.getSettings();
		await window.api.saveSettings({
			...settings,
			lastTab: activeTab.value,
			connectionMode: connectionMode.value,
			theme: localStorage.getItem('theme') || 'dark',
			preferences: JSON.parse(JSON.stringify(toRaw(preferences.value))),
		});
	},
	{ deep: true },
);
</script>

<template>
	<div class="flex h-full">
		<!-- Sidebar -->
		<div id="sidebar" class="w-64 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col">
			<div class="p-6">
				<h1 class="text-xl font-bold flex items-center gap-2 text-shark-primary">
					{{ $t('sidebar.deviceName') }}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						class="w-6 h-6"
						fill="currentColor"
						stroke="none"
					>
						<path d="M3 12 6 8 9 7 10 2 12 8 17 9 22 6 19 11 22 16 16 16 12 17 8 16 5 15 4 13Z" />
						<circle cx="6" cy="10" r=".6" />
					</svg>
				</h1>
			</div>

			<nav class="flex-1 px-4 space-y-2">
				<button
					v-if="!(connectionMode === 'Wired' && isConnected)"
					@click="activeTab = 'preferences'"
					:class="[
						'w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
						activeTab === 'preferences'
							? 'bg-shark-primary/20 text-shark-primary'
							: 'hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text)]',
					]"
				>
					<Settings class="w-5 h-5" /> {{ $t('sidebar.preferences') }}
				</button>
				<button
					@click="activeTab = 'dpi'"
					:class="[
						'w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
						activeTab === 'dpi'
							? 'bg-shark-primary/20 text-shark-primary'
							: 'hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text)]',
					]"
				>
					<Zap class="w-5 h-5" /> {{ $t('sidebar.dpi') }}
				</button>
				<button
					@click="activeTab = 'macros'"
					:class="[
						'w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
						activeTab === 'macros'
							? 'bg-shark-primary/20 text-shark-primary'
							: 'hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text)]',
					]"
				>
					<Keyboard class="w-5 h-5" /> {{ $t('sidebar.macros') }}
				</button>
				<button
					@click="activeTab = 'device-info'"
					:class="[
						'w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
						activeTab === 'device-info'
							? 'bg-shark-primary/20 text-shark-primary'
							: 'hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text)]',
					]"
				>
					<ShieldAlert class="w-5 h-5" /> {{ $t('sidebar.deviceInfo') }}
				</button>
			</nav>

			<div class="p-4 bg-[var(--sidebar-footer-bg)] border-t border-[var(--sidebar-footer-border)] space-y-2">
				<div class="flex items-center justify-between">
					<LanguageSelector />
					<ThemeToggle />
				</div>
				<div v-if="isConnected" class="flex items-center gap-3 text-sm">
					<template v-if="batteryLevel >= 0">
						<div class="relative w-8 h-4 border border-[var(--sidebar-border)] rounded-sm p-0.5">
							<div
								class="h-full rounded-xs"
								:class="batteryLevel <= 20 ? 'bg-red-500' : 'bg-green-700'"
								:style="{ width: `${batteryLevel > 0 ? batteryLevel : 0}%` }"
							></div>
							<div
								class="absolute -right-1 top-1 w-1 h-2 bg-[var(--sidebar-text-dim)] rounded-r-sm"
							></div>
						</div>
						<span class="text-[var(--sidebar-text-footer)] font-medium">{{ batteryLevel }}%</span>
					</template>
					<template v-else>
						<Plug class="w-4 h-4 text-[var(--sidebar-text)]" />
						<span class="text-[var(--sidebar-text-footer)] font-medium">{{
							$t('connection.wiredDisplay')
						}}</span>
					</template>
				</div>
				<div v-else class="text-xs text-[var(--sidebar-text-muted)] italic">
					{{ $t('connection.disconnected') }}
				</div>
				<div class="text-[10px] text-[var(--sidebar-text-dim)] mt-2">v{{ version }}</div>
			</div>
		</div>

		<!-- Main Content -->
		<main class="flex-1 overflow-y-auto p-8 bg-[var(--bg-primary)]">
			<div
				v-if="!isConnected"
				class="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto"
			>
				<div class="w-20 h-20 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center mb-6">
					<MousePointer2 class="w-10 h-10 text-[var(--text-muted)]" />
				</div>
				<h2 class="text-2xl font-bold mb-2">{{ $t('connection.title') }}</h2>
				<p class="text-[var(--text-secondary)] mb-8">{{ $t('connection.description') }}</p>

				<div class="grid grid-cols-2 gap-4 w-full">
					<button
						@click="connect(0xfa60)"
						class="bg-[var(--connection-card-bg)] hover:bg-[var(--connection-card-hover)] p-4 rounded-xl border border-[var(--connection-card-border)] transition-all group"
					>
						<Zap
							class="w-8 h-8 mx-auto mb-2 text-[var(--connection-card-text)] group-hover:text-shark-primary"
						/>
						<span class="block font-semibold">{{ $t('connection.adapter') }}</span>
					</button>
					<button
						@click="connect(0xfa55)"
						class="bg-[var(--connection-card-bg)] hover:bg-[var(--connection-card-hover)] p-4 rounded-xl border border-[var(--connection-card-border)] transition-all group"
					>
						<ShieldAlert
							class="w-8 h-8 mx-auto mb-2 text-[var(--connection-card-text)] group-hover:text-shark-primary"
						/>
						<span class="block font-semibold">{{ $t('connection.wired') }}</span>
					</button>
				</div>

				<button
					@click="window.location.reload()"
					class="mt-8 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1 transition-colors"
				>
					<Info class="w-3 h-3" /> {{ $t('connection.forceRefresh') }}
				</button>

				<div
					v-if="connectionError"
					class="mt-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg"
				>
					{{ connectionError }}
					<p class="text-[10px] mt-2 opacity-50">{{ $t('connection.errorTip') }}</p>
				</div>
			</div>

			<div v-else>
				<!-- Preferences Content -->
				<div v-if="activeTab === 'preferences' && !(connectionMode === 'Wired' && isConnected)">
					<UserPreferences v-model="preferences" :isConnected="isConnected" />
				</div>

				<!-- DPI Content -->
				<div v-if="activeTab === 'dpi'">
					<DpiSettings :isConnected="isConnected" />
				</div>

				<!-- Macros Content -->
				<div v-if="activeTab === 'macros'">
					<MacroSettings :isConnected="isConnected" />
				</div>

				<!-- Device Info Content -->
				<div v-if="activeTab === 'device-info'">
					<DeviceInfo :isConnected="isConnected" />
				</div>
			</div>
		</main>
	</div>
</template>
