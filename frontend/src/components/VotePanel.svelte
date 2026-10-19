<script lang="ts">
	import { tick } from 'svelte';
	import { ApiError } from '../lib/api';
	import { deviceStore, type ResponseRef } from '../lib/deviceStore';
	import { errorMessage } from '../lib/errors';
	import { t, type MessageKey } from '../lib/i18n.svelte';
	import { editLink } from '../lib/links';
	import type { Poll } from '../lib/model';
	import { deleteResponse, editResponse, submitResponse, type LoadedResponse } from '../lib/polls';
	import { buildResponse, draftFromResponse, emptyResponse, type ResponseDraft } from '../lib/responseDraft';
	import Button from './Button.svelte';
	import ConfirmButton from './ConfirmButton.svelte';
	import CopyField from './CopyField.svelte';
	import Notice from './Notice.svelte';
	import ResponseForm from './ResponseForm.svelte';

	/** Voting on an open poll, and editing or deleting the responses this browser has tokens for. */
	type Props = {
		id: string;
		pollKey: string;
		poll: Poll;
		responses: LoadedResponse[];
		/** This browser's responses. */
		own: ResponseRef[];
		/** Reloads the poll after a change. */
		onchange: () => Promise<void>;
		/** A response to open for editing right away (from a personal edit link). */
		initialEdit?: string | undefined;
	};

	let { id, pollKey, poll, responses, own, onchange, initialEdit }: Props = $props();

	const ownResponses = $derived(responses.filter((entry) => own.some((ref) => ref.id === entry.id)));
	let draft = $state<ResponseDraft>(emptyResponse());
	/** The ID of the response being edited, or null for a new one. */
	let editing = $state<string | null>(null);
	let formOpen = $state(false);
	/** Without a response of its own, this browser always gets the form. */
	const showForm = $derived(formOpen || ownResponses.length === 0);
	let busy = $state(false);
	let error = $state<MessageKey | undefined>();
	let message = $state<MessageKey | undefined>();
	let heading: HTMLElement | undefined = $state();
	/** The response just created; its personal link is shown once with the thanks. */
	let created = $state<ResponseRef | null>(null);
	/** The responses whose personal link is shown in the list. */
	let linksShown = $state<Record<string, boolean>>({});

	function tokenOf(responseId: string): string | undefined {
		return own.find((ref) => ref.id === responseId)?.editToken;
	}

	function personalLink(ref: ResponseRef): string {
		return editLink(location.origin, id, pollKey, ref.id, ref.editToken);
	}

	async function openForm(entry: LoadedResponse | null) {
		editing = entry?.id ?? null;
		draft = entry === null ? emptyResponse() : draftFromResponse(entry.response, poll);
		error = undefined;
		message = undefined;
		created = null;
		formOpen = true;
		await tick();
		heading?.focus();
	}

	function closeForm() {
		editing = null;
		draft = emptyResponse();
		formOpen = false;
		error = undefined;
	}

	async function save(submitted: ResponseDraft) {
		busy = true;
		error = undefined;
		message = undefined;
		created = null;
		try {
			const document = buildResponse(submitted, poll);
			const token = editing === null ? undefined : tokenOf(editing);
			if (editing !== null && token !== undefined) {
				await editResponse(id, pollKey, poll, editing, token, document);
				message = 'vote.updated';
			} else {
				const response = await submitResponse(id, pollKey, poll, document);
				created = { id: response.id, editToken: response.editToken };
				deviceStore.saveResponse(id, pollKey, created);
				message = 'vote.saved';
			}
			// Reload first, so that the new response is in the list before the form closes.
			await onchange();
			closeForm();
		} catch (caught) {
			error = errorMessage(caught);
			if (caught instanceof ApiError && (caught.code === 'poll_closed' || caught.code === 'not_found')) {
				await onchange();
			}
		} finally {
			busy = false;
		}
	}

	/** A personal edit link opens its response in the form. */
	function openLinked() {
		const linked = responses.find((entry) => entry.id === initialEdit);
		if (linked !== undefined && tokenOf(linked.id) !== undefined) {
			editing = linked.id;
			draft = draftFromResponse(linked.response, poll);
			formOpen = true;
		}
	}

	openLinked();

	async function remove(entry: LoadedResponse) {
		const token = tokenOf(entry.id);
		if (token === undefined) {
			return;
		}
		busy = true;
		error = undefined;
		message = undefined;
		try {
			await deleteResponse(id, entry.id, token);
			deviceStore.forgetResponse(id, entry.id);
			if (editing === entry.id) {
				closeForm();
			}
			message = 'vote.deleted';
			await onchange();
		} catch (caught) {
			error = errorMessage(caught);
		} finally {
			busy = false;
		}
	}
</script>

<section class="panel" aria-labelledby="vote-title">
	<h2 id="vote-title" bind:this={heading} tabindex="-1">
		{editing === null ? t('vote.title') : t('vote.editTitle')}
	</h2>

	{#if message !== undefined}
		<Notice kind="success" role="status">
			<p>{t(message)}</p>
			{#if created !== null}
				<CopyField label={t('vote.personalLink')} hint={t('vote.personalHint')} value={personalLink(created)} />
			{/if}
		</Notice>
	{/if}

	{#if ownResponses.length > 0}
		<div class="own">
			<h3>{t('vote.own')}</h3>
			<ul>
				{#each ownResponses as entry (entry.id)}
					{@const token = tokenOf(entry.id)}
					<li>
						<span class="name">{entry.response.name}</span>
						<span class="buttons">
							<Button
								size="small"
								variant="quiet"
								aria-expanded={linksShown[entry.id] === true}
								aria-label={t('vote.personalLinkNamed', { name: entry.response.name })}
								onclick={() => (linksShown[entry.id] = !linksShown[entry.id])}
							>
								{t('vote.personalLink')}
							</Button>
							<Button
								size="small"
								aria-label={t('vote.editNamed', { name: entry.response.name })}
								onclick={() => openForm(entry)}
							>
								{t('vote.edit')}
							</Button>
							<ConfirmButton
								size="small"
								label={t('vote.delete')}
								ariaLabel={t('vote.deleteNamed', { name: entry.response.name })}
								question={t('vote.deleteQuestion')}
								confirmLabel={t('vote.delete')}
								{busy}
								onconfirm={() => remove(entry)}
							/>
						</span>
						{#if linksShown[entry.id] && token !== undefined}
							<div class="link">
								<CopyField
									label={t('vote.personalLink')}
									hint={t('vote.personalHint')}
									value={personalLink({ id: entry.id, editToken: token })}
								/>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if showForm}
		<ResponseForm
			{poll}
			bind:draft
			submitLabel={editing === null ? t('vote.submit') : t('vote.saveChanges')}
			{busy}
			error={error && t(error)}
			onsubmit={save}
			oncancel={ownResponses.length > 0 || editing !== null ? closeForm : undefined}
		/>
	{:else}
		{#if error !== undefined}
			<Notice kind="error" role="alert"><p>{t(error)}</p></Notice>
		{/if}
		<div>
			<Button onclick={() => openForm(null)}>{t('vote.addAnother')}</Button>
		</div>
	{/if}
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	h3 {
		margin-bottom: var(--space-2);
		font-size: 1rem;
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
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-small);
		background: var(--color-surface);
	}

	.name {
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.link {
		flex-basis: 100%;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
