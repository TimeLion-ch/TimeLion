<script lang="ts">
	import { errorMessage } from '../lib/errors';
	import { optionLabel } from '../lib/format';
	import { i18n, t, type MessageKey } from '../lib/i18n.svelte';
	import { adminLink, participantLink } from '../lib/links';
	import { closePoll, deletePoll, deleteResponse, reopenPoll, updatePoll, type LoadedPoll } from '../lib/polls';
	import Button from './Button.svelte';
	import ConfirmButton from './ConfirmButton.svelte';
	import CopyField from './CopyField.svelte';
	import Notice from './Notice.svelte';

	/** What the admin link allows: closing, the final option, deleting responses and the poll, and sharing. */
	type Props = {
		id: string;
		pollKey: string;
		adminToken: string;
		loaded: LoadedPoll;
		/** Reloads the poll after a change. */
		onchange: () => Promise<void>;
		/** After the poll was deleted. */
		ondeleted: () => void;
		/** Opens the poll form. */
		onedit: () => void;
	};

	let { id, pollKey, adminToken, loaded, onchange, ondeleted, onedit }: Props = $props();

	const uid = $props.id();
	const closed = $derived(loaded.meta.closedAt !== null);
	// svelte-ignore state_referenced_locally
	let finalChoice = $state(loaded.poll.finalOptionId ?? '');
	let open = $state(false);
	let busy = $state(false);
	let error = $state<MessageKey | undefined>();
	let message = $state<MessageKey | undefined>();

	/** Runs an admin action, then reloads; errors and the outcome are shown in the panel. */
	async function run(action: () => Promise<unknown>, success: MessageKey, reload = true) {
		busy = true;
		error = undefined;
		message = undefined;
		try {
			await action();
			message = success;
			if (reload) {
				await onchange();
			}
		} catch (caught) {
			error = errorMessage(caught);
		} finally {
			busy = false;
		}
	}

	function saveFinal() {
		const poll = $state.snapshot(loaded.poll);
		if (finalChoice === '') {
			delete poll.finalOptionId;
		} else {
			poll.finalOptionId = finalChoice;
		}
		return run(
			() => updatePoll(id, pollKey, adminToken, poll),
			poll.type === 'text' ? 'admin.finalSavedText' : 'admin.finalSaved',
		);
	}

	function toggleClosed() {
		return closed
			? run(() => reopenPoll(id, adminToken), 'admin.reopened')
			: run(() => closePoll(id, adminToken), 'admin.closedMessage');
	}

	function removeResponse(responseId: string) {
		return run(() => deleteResponse(id, responseId, adminToken), 'admin.responseDeleted');
	}

	async function removePoll() {
		await run(() => deletePoll(id, adminToken), 'admin.deleted', false);
		if (error === undefined) {
			ondeleted();
		}
	}
</script>

<section class="admin" aria-labelledby="admin-title">
	<h2 id="admin-title">
		<button
			type="button"
			class="toggle"
			aria-expanded={open}
			aria-controls="{uid}-body"
			onclick={() => (open = !open)}
		>
			{t('admin.title')}
			<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"
				><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" /></svg
			>
		</button>
	</h2>

	<div id="{uid}-body" class="body" hidden={!open}>
		<p class="muted">{t('admin.lead')}</p>

		{#if message !== undefined}
			<Notice kind="success" role="status"><p>{t(message)}</p></Notice>
		{/if}
		{#if error !== undefined}
			<Notice kind="error" role="alert"><p>{t(error)}</p></Notice>
		{/if}

		<div class="group">
			<h3>{t('admin.status')}</h3>
			<p>{closed ? t('admin.statusClosed') : t('admin.statusOpen')}</p>
			<div class="row">
				<Button {busy} onclick={toggleClosed}>{closed ? t('admin.reopen') : t('admin.close')}</Button>
			</div>
		</div>

		{#if loaded.poll.type === 'dates'}
			<div class="group">
				<h3>{t('admin.edit')}</h3>
				<p class="muted">{t('admin.editHint')}</p>
				<div>
					<Button onclick={onedit}>{t('admin.edit')}</Button>
				</div>
			</div>
		{/if}

		<div class="group">
			<h3>
				<label for="{uid}-final">
					{loaded.poll.type === 'text' ? t('admin.finalText') : t('admin.final')}
				</label>
			</h3>
			<p id="{uid}-final-hint" class="muted">
				{loaded.poll.type === 'text' ? t('admin.finalHintText') : t('admin.finalHint')}
			</p>
			<div class="row">
				<select id="{uid}-final" bind:value={finalChoice} aria-describedby="{uid}-final-hint">
					<option value="">{t('admin.finalNone')}</option>
					{#each loaded.poll.options as option (option.id)}
						<option value={option.id}>{optionLabel(option, i18n.locale)}</option>
					{/each}
				</select>
				<Button {busy} onclick={saveFinal}>{t('admin.finalSave')}</Button>
			</div>
		</div>

		{#if loaded.responses.length > 0 || loaded.skippedResponses.length > 0}
			<div class="group">
				<h3>{t('admin.responses')}</h3>
				<ul>
					{#each loaded.responses as entry (entry.id)}
						<li>
							<span class="name">{entry.response.name}</span>
							<ConfirmButton
								size="small"
								label={t('vote.delete')}
								ariaLabel={t('vote.deleteNamed', { name: entry.response.name })}
								question={t('vote.deleteQuestion')}
								confirmLabel={t('vote.delete')}
								{busy}
								onconfirm={() => removeResponse(entry.id)}
							/>
						</li>
					{/each}
					{#each loaded.skippedResponses as responseId, index (responseId)}
						<li>
							<span class="name muted">{t('admin.unreadable', { number: index + 1 })}</span>
							<ConfirmButton
								size="small"
								label={t('vote.delete')}
								ariaLabel={t('admin.deleteUnreadable', { number: index + 1 })}
								question={t('vote.deleteQuestion')}
								confirmLabel={t('vote.delete')}
								{busy}
								onconfirm={() => removeResponse(responseId)}
							/>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="group">
			<h3>{t('admin.links')}</h3>
			<CopyField label={t('share.participantLink')} value={participantLink(location.origin, id, pollKey)} />
			<CopyField
				label={t('share.adminLink')}
				hint={t('share.adminHint')}
				value={adminLink(location.origin, id, pollKey, adminToken)}
			/>
		</div>

		<div class="group">
			<h3>{t('admin.delete')}</h3>
			<p class="muted">{t('admin.deleteHint')}</p>
			<div>
				<ConfirmButton
					label={t('admin.delete')}
					question={t('admin.deleteQuestion')}
					confirmLabel={t('admin.deleteConfirm')}
					{busy}
					onconfirm={removePoll}
				/>
			</div>
		</div>
	</div>
</section>

<style>
	.admin {
		padding: var(--space-2) var(--space-3);
		border: 2px solid var(--color-primary);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		width: 100%;
		min-height: 2.75rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.toggle svg {
		flex: none;
		color: var(--color-primary);
	}

	.toggle[aria-expanded='true'] svg {
		transform: rotate(180deg);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-bottom: var(--space-2);
	}

	.body[hidden] {
		display: none;
	}

	h3 {
		margin-bottom: var(--space-2);
		font-size: 1rem;
	}

	p {
		margin-bottom: var(--space-2);
	}

	.muted {
		color: var(--color-muted);
	}

	.body > .muted {
		margin: 0;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
	}

	.group > * {
		margin: 0;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	select {
		flex: 1 1 14rem;
		width: auto;
		min-width: 0;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding-block: var(--space-1);
	}

	.name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	@media (min-width: 40rem) {
		.admin {
			padding-inline: var(--space-4);
		}
	}
</style>
