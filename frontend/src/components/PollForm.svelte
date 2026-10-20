<script lang="ts">
	import { tick } from 'svelte';
	import { timeZones } from '../lib/dates';
	import { t } from '../lib/i18n.svelte';
	import { limits } from '../lib/model';
	import { defaultExpiryDate, maxExpiryDate, toggleDay, validateDraft, type PollDraft } from '../lib/pollDraft';
	import Button from './Button.svelte';
	import Calendar from './Calendar.svelte';
	import DayList from './DayList.svelte';
	import Notice from './Notice.svelte';
	import TextField from './TextField.svelte';
	import TextOptionList from './TextOptionList.svelte';

	/** The fields of a poll, for creating one and (with `autoExpiry` and `chooseType` off) for editing it. */
	type Props = {
		draft: PollDraft;
		today: string;
		submitLabel: string;
		busy?: boolean;
		/** The expiry follows the last date until the user changes it. */
		autoExpiry?: boolean;
		/** Offers dates or text options. Off for editing: changing the type would drop every vote. */
		chooseType?: boolean;
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
		chooseType = true,
		error,
		onsubmit,
		oncancel,
	}: Props = $props();

	const id = $props.id();
	/** Errors show up after the first attempt to submit, and then follow every change. */
	let attempted = $state(false);
	const errors = $derived(attempted ? validateDraft(draft, today) : {});
	let titleField: HTMLInputElement | HTMLTextAreaElement | undefined = $state();
	let minField: HTMLInputElement | HTMLTextAreaElement | undefined = $state();
	let maxField: HTMLInputElement | HTMLTextAreaElement | undefined = $state();
	let expiryField: HTMLInputElement | HTMLTextAreaElement | undefined = $state();
	let optionsGroup: HTMLFieldSetElement | undefined = $state();
	/** The expiry this form set last; once the user picks another one, it stays. */
	// svelte-ignore state_referenced_locally
	let automaticExpiry = autoExpiry ? draft.expiryDate : null;

	const selectedDates = $derived(draft.days.map((day) => day.date));
	// svelte-ignore state_referenced_locally
	const zones = timeZones(draft.timezone);

	function followExpiry() {
		if (automaticExpiry !== null && draft.expiryDate === automaticExpiry) {
			draft.expiryDate = automaticExpiry = defaultExpiryDate(draft, today);
		}
	}

	function toggle(date: string) {
		draft.days = toggleDay(draft.days, date);
		followExpiry();
	}

	function chooseKind(type: PollDraft['type']) {
		draft.type = type;
		followExpiry();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) {
			return;
		}
		attempted = true;
		if (Object.keys(errors).length === 0) {
			onsubmit(draft);
			return;
		}
		await tick();
		const firstSlot = Object.keys(errors.slots ?? {})[0];
		const firstText = Object.keys(errors.textItems ?? {})[0];
		if (errors.title !== undefined) {
			titleField?.focus();
		} else if (errors.days !== undefined) {
			optionsGroup?.querySelector<HTMLButtonElement>('button[data-date][tabindex="0"]')?.focus();
		} else if (firstSlot !== undefined) {
			optionsGroup?.querySelector<HTMLInputElement>(`[data-slot="${firstSlot}"]`)?.focus();
		} else if (errors.texts !== undefined) {
			optionsGroup?.querySelector<HTMLButtonElement>('[data-add]')?.focus();
		} else if (firstText !== undefined) {
			optionsGroup?.querySelector<HTMLInputElement>(`[data-text="${firstText}"]`)?.focus();
		} else if (errors.minChoices !== undefined) {
			minField?.focus();
		} else if (errors.maxChoices !== undefined) {
			maxField?.focus();
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

	<fieldset bind:this={optionsGroup} aria-describedby="{id}-{draft.type}-hint">
		<legend>
			{chooseType ? t('form.options') : draft.type === 'text' ? t('form.type.text') : t('form.dates')}
		</legend>
		{#if chooseType}
			<div class="type" role="radiogroup" aria-labelledby="{id}-type">
				<p id="{id}-type" class="label">{t('form.type')}</p>
				{#each ['dates', 'text'] as const as type (type)}
					<label class="check">
						<input
							type="radio"
							name="{id}-type"
							value={type}
							checked={draft.type === type}
							onchange={() => chooseKind(type)}
						/>
						{t(`form.type.${type}`)}
					</label>
				{/each}
			</div>
		{/if}

		{#if draft.type === 'text'}
			<p id="{id}-text-hint" class="hint">{t('form.textsHint')}</p>
			<TextOptionList
				bind:texts={draft.texts}
				errors={errors.textItems}
				describedby={errors.texts === undefined ? undefined : `${id}-texts-error`}
			/>
			{#if errors.texts !== undefined}
				<p id="{id}-texts-error" class="error">{t(errors.texts)}</p>
			{/if}
			<div class="limits" role="group" aria-labelledby="{id}-limits" aria-describedby="{id}-limits-hint">
				<p id="{id}-limits" class="label">{t('form.limits')}</p>
				<p id="{id}-limits-hint" class="hint">{t('form.limitsHint')}</p>
				<div class="limit-fields">
					<TextField
						label={t('form.minChoices')}
						bind:value={draft.minChoices}
						bind:element={minField}
						optional
						inputmode="numeric"
						error={errors.minChoices && t(errors.minChoices)}
					/>
					<TextField
						label={t('form.maxChoices')}
						bind:value={draft.maxChoices}
						bind:element={maxField}
						optional
						inputmode="numeric"
						error={errors.maxChoices && t(errors.maxChoices)}
					/>
				</div>
			</div>
		{:else}
			<p id="{id}-dates-hint" class="hint">{t('form.datesHint')}</p>
			<div class="dates">
				<Calendar
					selected={selectedDates}
					ontoggle={toggle}
					{today}
					min={today}
					describedby={errors.days === undefined ? undefined : `${id}-dates-error`}
				/>
				<DayList bind:days={draft.days} errors={errors.slots} onremove={toggle} />
			</div>
			{#if errors.days !== undefined}
				<p id="{id}-dates-error" class="error">{t(errors.days)}</p>
			{/if}
			<div class="zone">
				<label for="{id}-timezone">{t('form.timezone')}</label>
				<p id="{id}-timezone-hint" class="hint">{t('form.timezoneHint')}</p>
				<select id="{id}-timezone" bind:value={draft.timezone} aria-describedby="{id}-timezone-hint">
					{#each zones as zone (zone)}
						<option value={zone}>{zone.replaceAll('_', ' ')}</option>
					{/each}
				</select>
			</div>
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

	.label {
		margin: 0;
		font-weight: 700;
	}

	.type {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
	}

	.type .label {
		flex-basis: 100%;
	}

	.limits {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.limit-fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 12rem));
		gap: var(--space-3);
		margin-top: var(--space-2);
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

	.zone {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		max-width: 24rem;
	}

	.zone label {
		font-weight: 700;
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
