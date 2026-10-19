<script lang="ts">
	import Button from '../components/Button.svelte';
	import ConfirmButton from '../components/ConfirmButton.svelte';
	import Notice from '../components/Notice.svelte';
	import { deviceStore, type DevicePoll } from '../lib/deviceStore';
	import { loadProblem } from '../lib/errors';
	import { formatTimestamp } from '../lib/format';
	import { i18n, t } from '../lib/i18n.svelte';
	import { adminLink, participantLink } from '../lib/links';
	import { loadPoll } from '../lib/polls';
	import { link } from '../lib/router.svelte';

	/** The polls saved in this browser (deviceStore.ts). */
	let polls = $state<DevicePoll[]>(deviceStore.list());
	/** Titles decrypted on this page for entries that have none stored, or why that failed. */
	let fetched = $state<Record<string, { title: string } | { problem: 'gone' | 'unreadable' | 'failed' }>>({});
	let forgotten = $state(false);

	function path(poll: DevicePoll): string {
		const url = new URL(
			poll.adminToken === undefined
				? participantLink(location.origin, poll.id, poll.key)
				: adminLink(location.origin, poll.id, poll.key, poll.adminToken),
		);
		return url.pathname + url.hash;
	}

	function forget(id: string) {
		deviceStore.forget(id);
		polls = deviceStore.list();
		forgotten = true;
	}

	function forgetAll() {
		deviceStore.forgetAll();
		polls = deviceStore.list();
		forgotten = true;
	}

	/** One poll at a time, and only those without a stored title, so that the server sees as few requests as needed. */
	async function fetchTitles() {
		for (const poll of polls.filter((entry) => entry.title === undefined)) {
			try {
				fetched[poll.id] = { title: (await loadPoll(poll.id, poll.key)).poll.title };
			} catch (error) {
				const problem = loadProblem(error);
				fetched[poll.id] = {
					problem: problem === 'notFound' ? 'gone' : problem === 'unreadable' ? 'unreadable' : 'failed',
				};
			}
		}
	}

	void fetchTitles();
</script>

<svelte:head>
	<title>{t('my.title')} · {t('app.name')}</title>
</svelte:head>

<div class="page">
	<h1>{t('my.title')}</h1>
	<Notice>
		<p>{t('my.explanation')}</p>
	</Notice>

	{#if forgotten}
		<p class="visually-hidden" role="status">{t('my.forgotten')}</p>
	{/if}

	{#if polls.length === 0}
		<p class="empty">{t('my.empty')}</p>
		<div>
			<Button href="/new" variant="primary">{t('home.create')}</Button>
		</div>
	{:else}
		<ul>
			{#each polls as poll (poll.id)}
				{@const state = fetched[poll.id]}
				{@const title = poll.title ?? (state !== undefined && 'title' in state ? state.title : undefined)}
				<li>
					<div class="info">
						<a class="title" href={path(poll)} use:link>
							{#if title !== undefined}
								{title}
							{:else if state === undefined}
								{t('my.decrypting')}
							{:else}
								{t('my.untitled')}
							{/if}
						</a>
						<p class="meta">
							{#if poll.adminToken !== undefined}<span class="badge">{t('my.admin')}</span>{/if}
							{#if poll.responses.length > 0}
								<span class="badge">{t('my.responses', { count: poll.responses.length })}</span>
							{/if}
							{#if poll.savedAt > 0}
								<span>{t('my.saved', { date: formatTimestamp(poll.savedAt, i18n.locale) })}</span>
							{/if}
						</p>
						{#if state !== undefined && 'problem' in state}
							<p class="problem">{t(`my.problem.${state.problem}`)}</p>
						{/if}
					</div>
					<ConfirmButton
						size="small"
						label={t('my.forget')}
						ariaLabel={t('my.forgetNamed', { title: title ?? t('my.untitled') })}
						question={t('my.forgetQuestion')}
						confirmLabel={t('my.forget')}
						onconfirm={() => forget(poll.id)}
					/>
				</li>
			{/each}
		</ul>
		<div class="all">
			<ConfirmButton
				label={t('my.forgetAll')}
				question={t('my.forgetAllQuestion')}
				confirmLabel={t('my.forgetAll')}
				onconfirm={forgetAll}
			/>
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 48rem;
		margin-inline: auto;
	}

	h1 {
		margin: 0;
	}

	.empty {
		margin: 0;
		color: var(--color-muted);
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
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-small);
		background: var(--color-surface);
	}

	.info {
		display: flex;
		flex: 1 1 16rem;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.title {
		font-size: 1.0625rem;
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	p {
		margin: 0;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.badge {
		padding: 0 var(--space-2);
		border-radius: 999px;
		background: var(--color-surface-soft);
		color: var(--color-text);
		font-weight: 600;
	}

	.problem {
		color: var(--color-danger);
		font-size: 0.875rem;
		font-weight: 600;
	}
</style>
