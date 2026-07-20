<template>
	<div
		class="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-card)] shadow-md hover:shadow-xl hover:-translate-y-0.5"
		:class="$attrs.class"
	>
		<h3
			v-if="$slots.title"
			class="text-lg font-semibold border-b border-[var(--border-card)] pb-2 text-[var(--text-primary)] opacity-70 uppercase tracking-wider flex items-center gap-3 mb-6"
		>
			<slot name="title" />
		</h3>
		<slot />
	</div>
</template>
