<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import type { Vote } from '../lib/model';

	/** A vote as an icon, with its name for screen readers. No vote shows a dash. */
	let { vote }: { vote: Vote | undefined } = $props();
</script>

<span class={['vote', vote ?? 'none']}>
	<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
		{#if vote === 'yes'}
			<path d="m4 10.5 4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.5" />
		{:else if vote === 'maybe'}
			<path
				d="M3.5 11.5c2.2-3.2 4.3-3.2 6.5 0s4.3 3.2 6.5 0"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			/>
		{:else if vote === 'no'}
			<path d="m5.5 5.5 9 9m0-9-9 9" fill="none" stroke="currentColor" stroke-width="2.5" />
		{:else}
			<path d="M7 10h6" fill="none" stroke="currentColor" stroke-width="2" />
		{/if}
	</svg>
	<span class="visually-hidden">{vote === undefined ? t('vote.none') : t(`vote.${vote}`)}</span>
</span>

<style>
	.vote {
		display: inline-flex;
		vertical-align: middle;
	}

	.yes {
		color: var(--color-success);
	}

	.maybe {
		color: var(--color-warning);
	}

	.no {
		color: var(--color-danger);
	}

	.none {
		color: var(--color-muted);
	}
</style>
