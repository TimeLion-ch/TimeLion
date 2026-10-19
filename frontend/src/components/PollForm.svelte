<script lang="ts">
	import { tick } from 'svelte';
	import { formatDate } from '../lib/format';
	import { i18n, t } from '../lib/i18n.svelte';
	import { limits } from '../lib/model';
	import {
		defaultExpiryDate,
		maxExpiryDate,
		toggleDay,
		validateDraft,
		type DraftErrors,
		type PollDraft,
	} from '../lib/pollDraft';
	import Button from './Button.svelte';
	import Calendar from './Calendar.svelte';
	import Notice from './Notice.svelte';
	import TextField from './TextField.svelte';

	/** The fields of a poll, for creating one and (with `autoExpiry` off) for editing it. */
	type Props = {
		draft: PollDraft;
		today: string;
		submitLabel: string;
		busy?: boolean;
		/** The expiry follows the last date until the user changes it. */
		autoExpiry?: boolean;
		/** An error from saving, shown next to the buttons. */
		error?: string | undefined;
		onsubmit: (draft: PollDraft) => void;
		oncancel?: () => void;
	};

	let {
		draft = $bindable(),
		today,
		submitLabel,
		busy = false,
		autoExpiry = true,
		error,
		onsubmit,
		oncancel,
	}: Props = $props();

	const id = $props.id();
	let errors: DraftErrors = $state({});
	let titleField: HTMLInputElement | HTMLTextAreaElement | undefined = $state();
	let expiryField: HTMLInputElement | HTMLTextAreaElement | undefined = $state();
	let datesGroup: HTMLFieldSetElement | undefined = $state();
	/** The expiry this form set last; once the user picks another one, it stays. */
	// svelte-ignore state_referenced_locally
	let automaticExpiry = autoExpiry ? draft.expiryDate : null;

	const selectedDates = $derived(draft.days.map((day) => day.date));

	function toggle(date: string) {
		draft.days = toggleDay(draft.days, date);
		if (automaticExpiry !== null && draft.expiryDate === automaticExpiry) {
			draft.expiryDate = automaticExpiry = defaultExpiryDate(draft.days, today);
		}
		if (errors.days !== undefined) {
			errors = validateDraft(draft, today);
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) {
			return;
		}
		errors = validateDraft(draft, today);
		if (Object.keys(errors).length === 0) {
			onsubmit(draft);
			return;
		}
		await tick();
		if (errors.title !== undefined) {
			titleField?.focus();
		} else if (errors.days !== undefined) {
			datesGroup?.querySelector<HTMLButtonElement>('button[data-date][tabindex="0"]')?.focus();
		} else {
			expiryField?.focus();
		}
	}
</script>

<form novalidate onsubmit={submit}>
	<fieldset>
		<legend>{t('form.details')}</legend>
		<TextField
			label={t('form.title')}
			bind:value={draft.title}
			bind:element={titleField}
			required
			maxlength={limits.title}
			error={errors.title && t(errors.title)}
		/>
		<TextField
			label={t('form.description')}
			bind:value={draft.description}
			multiline
			optional
			maxlength={limits.description}
		/>
		<TextField label={t('form.location')} bind:value={draft.location} optional maxlength={limits.location} />
	</fieldset>

	<fieldset bind:this={datesGroup} aria-describedby="{id}-dates-hint">
		<legend>{t('form.dates')}</legend>
		<p id="{id}-dates-hint" class="hint">{t('form.datesHint')}</p>
		<div class="dates">
			<Calendar
				selected={selectedDates}
				ontoggle={toggle}
				{today}
				min={today}
				describedby={errors.days === undefined ? undefined : `${id}-dates-error`}
			/>
			<div class="picked">
				<h3>{t('form.selectedDates', { count: draft.days.length })}</h3>
				{#if draft.days.length === 0}
					<p class="hint">{t('form.noDates')}</p>
				{:else}
					<ul>
						{#each draft.days as day (day.date)}
							<li>
								<span>{formatDate(day.date, i18n.locale)}</span>
								<Button
									variant="quiet"
									size="small"
									aria-label={t('form.removeDate', {
										date: formatDate(day.date, i18n.locale, 'long'),
									})}
									onclick={() => toggle(day.date)}
								>
									<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"
										><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="2" /></svg
									>
								</Button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
		{#if errors.days !== undefined}
			<p id="{id}-dates-error" class="error">{t(errors.days)}</p>
		{/if}
	</fieldset>

	<fieldset>
		<legend>{t('form.settings')}</legend>
		<label class="check">
			<input type="checkbox" bind:checked={draft.allowMaybe} />
			{t('form.allowMaybe')}
		</label>
		<TextField
			type="date"
			label={t('form.expiry')}
			hint={t('form.expiryHint')}
			bind:value={draft.expiryDate}
			bind:element={expiryField}
			min={today}
			max={maxExpiryDate(today)}
			error={errors.expiry && t(errors.expiry)}
		/>
	</fieldset>

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
		gap: var(--space-4);
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	legend {
		padding-inline: var(--space-2);
		font-size: 1.125rem;
		font-weight: 800;
	}

	.hint {
		margin: 0;
		color: var(--color-muted);
	}

	.error {
		margin: 0;
		color: var(--color-danger);
		font-weight: 600;
	}

	.dates {
		display: grid;
		gap: var(--space-4);
	}

	@media (min-width: 48rem) {
		.dates {
			grid-template-columns: minmax(0, 24rem) 1fr;
		}
	}

	h3 {
		margin-bottom: var(--space-2);
		font-size: 1rem;
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
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding-left: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-small);
		background: var(--color-surface-soft);
	}

	.check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
	}

	.check input {
		width: 1.25rem;
		height: 1.25rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	@media (min-width: 40rem) {
		fieldset {
			padding: var(--space-4);
		}
	}
</style>
