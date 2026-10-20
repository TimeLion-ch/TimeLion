<script lang="ts">
	import { formatOption } from '../lib/format';
	import { i18n, t } from '../lib/i18n.svelte';
	import type { Poll } from '../lib/model';
	import type { LoadedResponse } from '../lib/polls';
	import { bestOptions, tally } from '../lib/results';
	import VoteIcon from './VoteIcon.svelte';

	/** Options as columns, responses as rows, and the totals below. */
	type Props = {
		poll: Poll;
		responses: LoadedResponse[];
		/** The IDs of this browser's responses, marked as "you". */
		own?: ReadonlySet<string>;
	};

	let { poll, responses, own = new Set() }: Props = $props();

	const id = $props.id();
	const tallies = $derived(
		tally(
			poll,
			responses.map((entry) => entry.response),
		),
	);
	const best = $derived(bestOptions(tallies));
</script>

<!-- Focusable, so that keyboard users can scroll a table wider than the screen. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="scroll" role="region" aria-labelledby="{id}-caption" tabindex="0">
	<table>
		<caption id="{id}-caption" class="visually-hidden">
			{poll.type === 'text' ? t('results.captionText') : t('results.caption')}
		</caption>
		<thead>
			<tr>
				<th scope="col" class="name">{t('results.participant')}</th>
				{#each poll.options as option (option.id)}
					{@const formatted = formatOption(option, i18n.locale, 'compact')}
					<th scope="col" class={{ best: best.has(option.id), final: poll.finalOptionId === option.id }}>
						<span class={poll.type === 'text' ? 'text' : 'date'}>{formatted.main}</span>
						{#if formatted.time !== null}
							<span class="time">{formatted.time}</span>
						{/if}
						{#if poll.finalOptionId === option.id}
							<span class="tag">{t('results.final')}</span>
						{:else if best.has(option.id)}
							<span class="tag">{t('results.best')}</span>
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each responses as entry (entry.id)}
				<tr class={{ own: own.has(entry.id) }}>
					<th scope="row" class="name">
						{entry.response.name}
						{#if own.has(entry.id)}<span class="you">({t('results.you')})</span>{/if}
					</th>
					{#each poll.options as option (option.id)}
						{@const vote = Object.hasOwn(entry.response.votes, option.id)
							? entry.response.votes[option.id]
							: undefined}
						<td class={vote ?? 'none'}><VoteIcon {vote} /></td>
					{/each}
				</tr>
			{:else}
				<tr>
					<td class="empty" colspan={poll.options.length + 1}>{t('results.empty')}</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<th scope="row" class="name">{t('results.yesTotal')}</th>
				{#each poll.options as option (option.id)}
					<td class={{ best: best.has(option.id) }}>{tallies.get(option.id)?.yes ?? 0}</td>
				{/each}
			</tr>
			{#if poll.allowMaybe}
				<tr>
					<th scope="row" class="name">{t('results.maybeTotal')}</th>
					{#each poll.options as option (option.id)}
						<td>{tallies.get(option.id)?.maybe ?? 0}</td>
					{/each}
				</tr>
			{/if}
		</tfoot>
	</table>
</div>

<style>
	.scroll {
		/* The containing block of the visually hidden labels, so that they scroll with the table. */
		position: relative;
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	table {
		min-width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-variant-numeric: tabular-nums;
	}

	th,
	td {
		padding: var(--space-2);
		border-bottom: 1px solid var(--color-border);
		text-align: center;
		vertical-align: middle;
	}

	thead th {
		min-width: 6.5rem;
		vertical-align: bottom;
		font-size: 0.875rem;
	}

	.name {
		position: sticky;
		left: 0;
		z-index: 1;
		min-width: 8rem;
		max-width: 14rem;
		background: var(--color-surface);
		text-align: left;
		overflow-wrap: anywhere;
	}

	.you {
		color: var(--color-muted);
		font-weight: 400;
	}

	.date,
	.time,
	.tag {
		display: block;
		white-space: nowrap;
	}

	/* As wide as the text, up to a limit; longer texts wrap. */
	.text {
		display: block;
		width: max-content;
		max-width: 14rem;
		overflow-wrap: anywhere;
	}

	.time {
		color: var(--color-muted);
		font-weight: 400;
	}

	.tag {
		margin-top: var(--space-1);
		color: var(--color-primary);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	th.best,
	th.final {
		box-shadow: inset 0 4px 0 var(--color-primary);
		background: var(--color-surface-soft);
	}

	td.yes {
		background: var(--color-success-soft);
	}

	td.maybe {
		background: var(--color-warning-soft);
	}

	tfoot th,
	tfoot td {
		border-bottom: 0;
		font-weight: 700;
	}

	tfoot tr:first-child > * {
		border-top: 2px solid var(--color-border);
	}

	tfoot td.best {
		color: var(--color-primary);
		font-size: 1.125rem;
	}

	tr.own > .name {
		box-shadow: inset 4px 0 0 var(--color-primary);
	}

	.empty {
		color: var(--color-muted);
		text-align: left;
	}
</style>
