<script lang="ts">
	import { formatOption } from '../lib/format';
	import { i18n, t } from '../lib/i18n.svelte';
	import type { Poll, Vote } from '../lib/model';
	import type { LoadedResponse } from '../lib/polls';
	import { bestOptions, tally } from '../lib/results';
	import VoteIcon from './VoteIcon.svelte';

	/** The results for narrow screens: one entry per option with the totals, your vote, and who voted what. */
	type Props = {
		poll: Poll;
		responses: LoadedResponse[];
		/** The IDs of this browser's responses. */
		own?: ReadonlySet<string>;
	};

	let { poll, responses, own = new Set() }: Props = $props();

	const tallies = $derived(
		tally(
			poll,
			responses.map((entry) => entry.response),
		),
	);
	const best = $derived(bestOptions(tallies));
	const ownResponses = $derived(responses.filter((entry) => own.has(entry.id)));
	const votes: Vote[] = ['yes', 'maybe', 'no'];

	function voteOf(entry: LoadedResponse, optionId: string): Vote | undefined {
		return Object.hasOwn(entry.response.votes, optionId) ? entry.response.votes[optionId] : undefined;
	}

	function namesWith(optionId: string, vote: Vote): string[] {
		return responses.filter((entry) => voteOf(entry, optionId) === vote).map((entry) => entry.response.name);
	}
</script>

<ul class="results">
	{#each poll.options as option (option.id)}
		{@const formatted = formatOption(option, i18n.locale)}
		{@const counts = tallies.get(option.id)}
		<li class={{ best: best.has(option.id), final: poll.finalOptionId === option.id }}>
			<h3>
				<span>{formatted.main}</span>
				{#if formatted.time !== null}<span class="time">{formatted.time}</span>{/if}
			</h3>
			{#if poll.finalOptionId === option.id}
				<p class="tag">{t('results.final')}</p>
			{:else if best.has(option.id)}
				<p class="tag">{t('results.best')}</p>
			{/if}

			<dl class="totals">
				{#each votes as vote (vote)}
					{#if vote !== 'maybe' || poll.allowMaybe || (counts?.maybe ?? 0) > 0}
						<div class={vote}>
							<dt><VoteIcon {vote} /></dt>
							<dd>{counts?.[vote] ?? 0}</dd>
						</div>
					{/if}
				{/each}
			</dl>

			{#each ownResponses as entry (entry.id)}
				{@const vote = voteOf(entry, option.id)}
				<p class="own">
					{ownResponses.length > 1
						? t('results.yourVoteNamed', { name: entry.response.name })
						: t('results.yourVote')}
					<strong>{vote === undefined ? t('vote.none') : t(`vote.${vote}`)}</strong>
				</p>
			{/each}

			{#if responses.length > 0}
				<details>
					<summary>{t('results.who')}</summary>
					<dl class="names">
						{#each votes as vote (vote)}
							{@const names = namesWith(option.id, vote)}
							{#if names.length > 0}
								<dt>{t(`vote.${vote}`)}</dt>
								<dd>{names.join(', ')}</dd>
							{/if}
						{/each}
					</dl>
				</details>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.results {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-small);
		background: var(--color-surface);
	}

	li.best,
	li.final {
		border-color: var(--color-primary);
		box-shadow: inset 4px 0 0 var(--color-primary);
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		overflow-wrap: anywhere;
	}

	.time {
		margin-left: var(--space-2);
		color: var(--color-muted);
		font-weight: 400;
	}

	p {
		margin: 0;
	}

	.tag {
		color: var(--color-primary);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.totals {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
	}

	.totals div {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px var(--space-2);
		border-radius: 999px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.totals .yes {
		background: var(--color-success-soft);
	}

	.totals .maybe {
		background: var(--color-warning-soft);
	}

	.totals .no {
		background: var(--color-danger-soft);
	}

	dd {
		margin: 0;
	}

	.own {
		font-size: 0.875rem;
	}

	summary {
		color: var(--color-primary);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	.names {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: var(--space-2) 0 0;
		font-size: 0.875rem;
	}

	.names dt {
		font-weight: 700;
	}

	.names dd {
		overflow-wrap: anywhere;
	}
</style>
