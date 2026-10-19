<script lang="ts">
	import { ApiError } from '../lib/api';
	import { deviceStore, type ResponseRef } from '../lib/deviceStore';
	import { errorMessage } from '../lib/errors';
	import { t, type MessageKey } from '../lib/i18n.svelte';
	import type { Poll } from '../lib/model';
	import { submitResponse, type LoadedResponse } from '../lib/polls';
	import { buildResponse, emptyResponse, type ResponseDraft } from '../lib/responseDraft';
	import Button from './Button.svelte';
	import Notice from './Notice.svelte';
	import ResponseForm from './ResponseForm.svelte';

	/** Voting on an open poll. */
	type Props = {
		id: string;
		pollKey: string;
		poll: Poll;
		responses: LoadedResponse[];
		/** This browser's responses. */
		own: ResponseRef[];
		/** Reloads the poll after a change. */
		onchange: () => Promise<void>;
	};

	let { id, pollKey, poll, responses, own, onchange }: Props = $props();

	const ownResponses = $derived(responses.filter((entry) => own.some((ref) => ref.id === entry.id)));
	let draft = $state<ResponseDraft>(emptyResponse());
	let formOpen = $state(false);
	/** Without a response of its own, this browser always gets the form. */
	const showForm = $derived(formOpen || ownResponses.length === 0);
	let busy = $state(false);
	let error = $state<MessageKey | undefined>();
	let message = $state<MessageKey | undefined>();

	function openForm() {
		draft = emptyResponse();
		error = undefined;
		message = undefined;
		formOpen = true;
	}

	function closeForm() {
		draft = emptyResponse();
		formOpen = false;
		error = undefined;
	}

	async function save(submitted: ResponseDraft) {
		busy = true;
		error = undefined;
		message = undefined;
		try {
			const created = await submitResponse(id, pollKey, poll, buildResponse(submitted, poll));
			deviceStore.saveResponse(id, pollKey, { id: created.id, editToken: created.editToken });
			message = 'vote.saved';
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
</script>

<section class="panel" aria-labelledby="vote-title">
	<h2 id="vote-title">{t('vote.title')}</h2>

	{#if message !== undefined}
		<Notice kind="success" role="status"><p>{t(message)}</p></Notice>
	{/if}

	{#if showForm}
		<ResponseForm
			{poll}
			bind:draft
			submitLabel={t('vote.submit')}
			{busy}
			error={error && t(error)}
			onsubmit={save}
			oncancel={ownResponses.length > 0 ? closeForm : undefined}
		/>
	{:else}
		<div>
			<Button onclick={openForm}>{t('vote.addAnother')}</Button>
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
</style>
