<script lang="ts">
	import { tick } from 'svelte';
	import { todayIn } from '../lib/dates';
	import { errorMessage } from '../lib/errors';
	import { optionLabel } from '../lib/format';
	import { i18n, t, type MessageKey } from '../lib/i18n.svelte';
	import type { Poll, PollOption } from '../lib/model';
	import { draftFromPoll, editedPoll, expiresAt, removedOptions, type PollDraft } from '../lib/pollDraft';
	import { updatePoll, type LoadedPoll } from '../lib/polls';
	import Button from './Button.svelte';
	import Notice from './Notice.svelte';
	import PollForm from './PollForm.svelte';

	/** The poll form for an existing poll (admin only). */
	type Props = {
		id: string;
		pollKey: string;
		adminToken: string;
		loaded: LoadedPoll;
		/** `saved` is true if the poll was changed. */
		ondone: (saved: boolean) => void;
	};

	let { id, pollKey, adminToken, loaded, ondone }: Props = $props();

	// svelte-ignore state_referenced_locally
	const original = draftFromPoll(loaded.poll, loaded.meta.expiresAt);
	let draft = $state<PollDraft>(structuredClone(original));
	// svelte-ignore state_referenced_locally
	const today = todayIn(loaded.poll.timezone);
	let busy = $state(false);
	let error = $state<MessageKey | undefined>();
	/** An edit that removes options with votes waits here until the admin confirms it. */
	let pending = $state<{ poll: Poll; expiresAt?: number; lost: PollOption[] } | null>(null);
	let warning: HTMLDivElement | undefined = $state();

	async function submit(submitted: PollDraft) {
		const poll = editedPoll(loaded.poll, submitted);
		const change: { poll: Poll; expiresAt?: number; lost: PollOption[] } = { poll, lost: [] };
		if (submitted.expiryDate !== original.expiryDate) {
			change.expiresAt = expiresAt(submitted, Math.floor(Date.now() / 1000));
		}
		change.lost = removedOptions(loaded.poll, poll).filter((option) =>
			loaded.responses.some((entry) => Object.hasOwn(entry.response.votes, option.id)),
		);
		if (change.lost.length > 0) {
			pending = change;
			await tick();
			warning?.focus();
			return;
		}
		await save(change);
	}

	async function save(change: { poll: Poll; expiresAt?: number }) {
		busy = true;
		error = undefined;
		try {
			await updatePoll(id, pollKey, adminToken, change.poll, change.expiresAt);
			ondone(true);
		} catch (caught) {
			error = errorMessage(caught);
			pending = null;
		} finally {
			busy = false;
		}
	}
</script>

<div class="edit">
	<h1>{t('edit.title')}</h1>
	{#if pending !== null}
		<Notice kind="warning" role="alert" title={t('edit.warningTitle')} bind:element={warning}>
			<p>{t('edit.warning', { count: pending.lost.length })}</p>
			<ul>
				{#each pending.lost as option (option.id)}
					<li>{optionLabel(option, i18n.locale)}</li>
				{/each}
			</ul>
			<div class="actions">
				<Button variant="danger" {busy} onclick={() => pending !== null && save(pending)}>
					{t('edit.saveAnyway')}
				</Button>
				<Button onclick={() => (pending = null)}>{t('edit.back')}</Button>
			</div>
		</Notice>
	{:else}
		<PollForm
			bind:draft
			{today}
			submitLabel={t('vote.saveChanges')}
			{busy}
			autoExpiry={false}
			error={error && t(error)}
			onsubmit={submit}
			oncancel={() => ondone(false)}
		/>
	{/if}
</div>

<style>
	.edit {
		max-width: 52rem;
		margin-inline: auto;
	}

	ul {
		margin: 0 0 var(--space-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
