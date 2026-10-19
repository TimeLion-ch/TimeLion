<script lang="ts">
	import Button from '../components/Button.svelte';
	import Notice from '../components/Notice.svelte';
	import ResultsTable from '../components/ResultsTable.svelte';
	import ShareScreen from '../components/ShareScreen.svelte';
	import VotePanel from '../components/VotePanel.svelte';
	import { deviceStore, type ResponseRef } from '../lib/deviceStore';
	import { loadProblem, type LoadProblem } from '../lib/errors';
	import { formatTimestamp, optionLabel } from '../lib/format';
	import { i18n, t } from '../lib/i18n.svelte';
	import { parseFragment } from '../lib/links';
	import { loadPoll, type LoadedPoll } from '../lib/polls';
	import { hasTimes } from '../lib/results';
	import { replaceState, router } from '../lib/router.svelte';

	/** A poll, opened with the key (and maybe a token) from the link's fragment. */
	let { id, hash }: { id: string; hash: string } = $props();

	// The page is re-created for every ID and fragment (App.svelte).
	// svelte-ignore state_referenced_locally
	const fragment = parseFragment(hash);

	let loaded = $state<LoadedPoll | null>(null);
	let problem = $state<LoadProblem | null>(fragment === null ? 'noKey' : null);
	let loading = $state(false);
	/** The responses this browser can edit. */
	let own = $state<ResponseRef[]>([]);

	const poll = $derived(loaded?.poll);
	const finalOption = $derived(poll?.options.find((option) => option.id === poll.finalOptionId));

	async function load() {
		if (fragment === null) {
			return;
		}
		loading = true;
		try {
			loaded = await loadPoll(id, fragment.key);
			problem = null;
			const details: { title: string; adminToken?: string } = { title: loaded.poll.title };
			if (fragment.adminToken !== undefined) {
				details.adminToken = fragment.adminToken;
			}
			deviceStore.savePoll(id, fragment.key, details);
			own = deviceStore.get(id)?.responses ?? [];
		} catch (error) {
			problem = loadProblem(error);
		} finally {
			loading = false;
		}
	}

	function dismissShare() {
		replaceState({});
		window.scrollTo(0, 0);
	}

	void load();
</script>

<svelte:head>
	<title>{poll === undefined ? t('poll.title') : poll.title} · {t('app.name')}</title>
</svelte:head>

{#if router.state.created && fragment?.adminToken !== undefined}
	<ShareScreen {id} pollKey={fragment.key} adminToken={fragment.adminToken} ondone={dismissShare} />
{:else if problem !== null}
	<section class="problem">
		<h1>{t(`poll.${problem}.title`)}</h1>
		<p>{t(`poll.${problem}.text`)}</p>
		<div class="actions">
			{#if problem === 'network' || problem === 'generic'}
				<Button variant="primary" busy={loading} onclick={load}>{t('poll.retry')}</Button>
			{/if}
			<Button href="/">{t('notFound.back')}</Button>
		</div>
	</section>
{:else if loaded === null || poll === undefined}
	<p class="loading" role="status">{t('poll.loading')}</p>
{:else}
	<article class="poll">
		<header>
			<h1>{poll.title}</h1>
			{#if poll.location !== undefined}
				<p class="location">
					<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"
						><path
							d="M10 18s6-5.3 6-10a6 6 0 0 0-12 0c0 4.7 6 10 6 10Z"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
						/><circle cx="10" cy="8" r="2.2" fill="currentColor" /></svg
					>
					<span class="visually-hidden">{t('poll.location')}:</span>
					{poll.location}
				</p>
			{/if}
			{#if poll.description !== undefined}
				<p class="description">{poll.description}</p>
			{/if}
			<p class="meta">
				{t('poll.expires', { date: formatTimestamp(loaded.meta.expiresAt, i18n.locale) })}
				{#if hasTimes(poll)}
					· {t('poll.timezone', { zone: poll.timezone.replaceAll('_', ' ') })}
				{/if}
			</p>
		</header>

		{#if finalOption !== undefined}
			<Notice kind="success" title={t('poll.finalTitle')}>
				<p>{optionLabel(finalOption, i18n.locale, 'long')}</p>
			</Notice>
		{/if}
		{#if loaded.meta.closedAt !== null}
			<Notice>
				<p>{t('poll.closed')}</p>
			</Notice>
		{/if}
		{#if loaded.skippedResponses.length > 0}
			<Notice kind="warning">
				<p>{t('poll.skipped', { count: loaded.skippedResponses.length })}</p>
			</Notice>
		{/if}

		<section aria-labelledby="results-title">
			<h2 id="results-title">{t('results.title', { count: loaded.responses.length })}</h2>
			<ResultsTable {poll} responses={loaded.responses} />
		</section>

		{#if loaded.meta.closedAt === null && fragment !== null}
			<VotePanel {id} pollKey={fragment.key} {poll} responses={loaded.responses} {own} onchange={load} />
		{/if}
	</article>
{/if}

<style>
	.problem,
	.loading {
		max-width: 40rem;
		margin-inline: auto;
		text-align: center;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
	}

	.poll {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	header > :last-child {
		margin-bottom: 0;
	}

	h1 {
		overflow-wrap: anywhere;
	}

	.location {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.location svg {
		flex: none;
		color: var(--color-primary);
	}

	.description {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.meta {
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	h2 {
		font-size: 1.25rem;
	}
</style>
