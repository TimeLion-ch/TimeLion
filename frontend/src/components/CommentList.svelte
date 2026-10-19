<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import type { LoadedResponse } from '../lib/polls';

	/** The comments of the responses, as plain text with their line breaks. */
	let { responses }: { responses: LoadedResponse[] } = $props();

	const comments = $derived(responses.filter((entry) => entry.response.comment));
</script>

{#if comments.length > 0}
	<h3>{t('results.comments')}</h3>
	<ul>
		{#each comments as entry (entry.id)}
			<li>
				<span class="author">{entry.response.name}</span>
				<p>{entry.response.comment}</p>
			</li>
		{/each}
	</ul>
{/if}

<style>
	h3 {
		margin-top: var(--space-4);
		font-size: 1.0625rem;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-border-strong);
		overflow-wrap: anywhere;
	}

	.author {
		font-weight: 700;
	}

	p {
		margin: 0;
		white-space: pre-wrap;
	}
</style>
