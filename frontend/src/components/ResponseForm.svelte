<script lang="ts">
	import { tick } from 'svelte';
	import { formatOption } from '../lib/format';
	import { i18n, t } from '../lib/i18n.svelte';
	import { choiceCount, choiceProblem, limits, type Poll } from '../lib/model';
	import { choiceRule, choices, validateResponse, type ResponseDraft } from '../lib/responseDraft';
	import Button from './Button.svelte';
	import Notice from './Notice.svelte';
	import TextField from './TextField.svelte';
	import VoteIcon from './VoteIcon.svelte';

	/** Name, a vote per option and a comment: for a new response or for editing one. */
	type Props = {
		poll: Poll;
		draft: ResponseDraft;
		submitLabel: string;
		/** For an existing response: one that no longer fits the choice limits shows the problem right away. */
		editing?: boolean;
		busy?: boolean;
		error?: string | undefined;
		onsubmit: (draft: ResponseDraft) => void;
		oncancel?: (() => void) | undefined;
	};

	let {
		poll,
		draft = $bindable(),
		submitLabel,
		editing = false,
		busy = false,
		error,
		onsubmit,
		oncancel,
	}: Props = $props();

	const id = $props.id();
	/** Errors show up after the first attempt to submit, and then follow every change. */
	// svelte-ignore state_referenced_locally
	let attempted = $state(editing && choiceProblem(poll, draft.votes) !== null);
	const errors = $derived(attempted ? validateResponse(draft, poll) : {});
	const rule = $derived(choiceRule(poll));
	let nameField: HTMLInputElement | HTMLTextAreaElement | undefined = $state();
	let optionList: HTMLElement | undefined = $state();

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) {
			return;
		}
		attempted = true;
		if (errors.name !== undefined) {
			await tick();
			nameField?.focus();
			return;
		}
		if (errors.choices !== undefined) {
			await tick();
			optionList?.focus();
			return;
		}
		onsubmit(draft);
	}
</script>

<form novalidate onsubmit={submit}>
	<TextField
		label={t('vote.name')}
		bind:value={draft.name}
		bind:element={nameField}
		required
		maxlength={limits.name}
		autocomplete="name"
		error={errors.name && t(errors.name)}
	/>

	{#if rule !== null}
		<div class="limit">
			<p id="{id}-limit">
				<strong>{t(rule.key, rule.params)}</strong>
				{#if poll.allowMaybe}{t('vote.limit.maybeCounts')}{/if}
			</p>
			<p role="status">{t('vote.limit.count', { count: choiceCount(poll, draft.votes) })}</p>
			{#if errors.choices !== undefined}
				<p id="{id}-choices-error" class="error">{t(errors.choices)}</p>
			{/if}
		</div>
	{/if}

	<!-- With choice limits, the list is named by them, so that focusing it after a failed submit explains why. -->
	<!-- Only ever tabindex -1: focusable by script, not in the tab order. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<ul
		class="options"
		bind:this={optionList}
		tabindex={rule === null ? undefined : -1}
		aria-labelledby={rule === null ? undefined : `${id}-limit`}
		aria-describedby={errors.choices === undefined ? undefined : `${id}-choices-error`}
	>
		{#each poll.options as option (option.id)}
			{@const formatted = formatOption(option, i18n.locale)}
			<li>
				<fieldset>
					<legend>
						<span>{formatted.main}</span>
						{#if formatted.time !== null}<span class="time">{formatted.time}</span>{/if}
					</legend>
					<div class="choices">
						{#each choices(poll) as choice (choice)}
							<label class={choice}>
								<input
									type="radio"
									name="{id}-{option.id}"
									value={choice}
									bind:group={draft.votes[option.id]}
								/>
								<VoteIcon vote={choice} />
								<span aria-hidden="true">{t(`vote.${choice}`)}</span>
							</label>
						{/each}
					</div>
				</fieldset>
			</li>
		{/each}
	</ul>

	<TextField
		label={t('vote.comment')}
		bind:value={draft.comment}
		multiline
		rows={2}
		optional
		maxlength={limits.comment}
	/>

	{#if error !== undefined}
		<Notice kind="error" role="alert">{error}</Notice>
	{/if}

	<div class="actions">
		<Button type="submit" variant="primary" {busy}>{submitLabel}</Button>
		{#if oncancel !== undefined}
			<Button onclick={oncancel}>{t('common.cancel')}</Button>
		{/if}
	</div>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.limit p {
		margin: 0;
	}

	.error {
		color: var(--color-danger);
		font-weight: 600;
	}

	.options:focus {
		outline: none;
	}

	.options:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}

	.options {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	fieldset {
		height: 100%;
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-small);
		background: var(--color-surface);
	}

	legend {
		float: left;
		width: 100%;
		margin-bottom: var(--space-2);
		padding: 0;
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.time {
		margin-left: var(--space-2);
		color: var(--color-muted);
		font-weight: 400;
	}

	.choices {
		clear: both;
		display: flex;
		gap: var(--space-1);
	}

	label {
		position: relative;
		display: inline-flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-height: 2.75rem;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-small);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	/* The radio stays in the accessibility tree and keyboard order; the label shows its state. */
	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	label:has(input:focus-visible) {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}

	label.yes:has(input:checked) {
		border-color: var(--color-success);
		background: var(--color-success-soft);
		box-shadow: inset 0 0 0 1px var(--color-success);
	}

	label.maybe:has(input:checked) {
		border-color: var(--color-warning);
		background: var(--color-warning-soft);
		box-shadow: inset 0 0 0 1px var(--color-warning);
	}

	label.no:has(input:checked) {
		border-color: var(--color-danger);
		background: var(--color-danger-soft);
		box-shadow: inset 0 0 0 1px var(--color-danger);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
