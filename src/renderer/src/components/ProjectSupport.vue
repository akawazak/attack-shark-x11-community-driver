<script setup lang="ts">
import { ref } from 'vue';
import { ExternalLink, Star } from 'lucide-vue-next';

const isOpening = ref(false);

const openProject = async () => {
	if (isOpening.value) return;
	isOpening.value = true;
	try {
		await window.api.openProjectPage();
	} finally {
		isOpening.value = false;
	}
};
</script>

<template>
	<section
		class="mt-4 flex flex-col gap-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)]/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
		:aria-label="$t('support.title')"
	>
		<div class="flex min-w-0 items-center gap-3">
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-shark-primary/30 text-shark-primary"
				aria-hidden="true"
			>
				<Star class="h-4 w-4" />
			</div>
			<div class="min-w-0">
				<h2 class="text-sm font-semibold text-[var(--text-primary)]">{{ $t('support.title') }}</h2>
				<p class="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
					{{ $t('support.description') }}
				</p>
			</div>
		</div>
		<button
			type="button"
			class="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-[var(--border-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-shark-primary/50 hover:text-shark-primary disabled:cursor-default disabled:opacity-60 sm:self-auto"
			:disabled="isOpening"
			@click="openProject"
		>
			<Star class="h-3.5 w-3.5" aria-hidden="true" />
			{{ $t('support.star') }}
			<ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
		</button>
	</section>
</template>
