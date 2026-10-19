<script lang="ts">
	import { tick } from 'svelte';
	import { formatDate } from '../lib/format';
	import { i18n, t, type MessageKey } from '../lib/i18n.svelte';
	import { copySlots, endsNextDay, slotKey, type DraftDay } from '../lib/pollDraft';
	import Button from './Button.svelte';

	/** The selected days of the poll form, each as a whole day or with time slots. */
	type Props = {
		days: DraftDay[];
		/** By `slotKey(date, index)`. */
		errors?: Record<string, MessageKey> | undefined;
		onremove: (date: string) => void;
	};

	let { days = $bindable(), errors, onremove }: Props = $props();

	const id = $props.id();
	let list: HTMLElement | undefined = $state();
	let heading: HTMLElement | undefined = $state();
	let announcement = $state('');

	async function focus(selector: string) {
		await tick();
		list?.querySelector<HTMLElement>(selector)?.focus();
	}

	function addSlot(day: DraftDay) {
		day.slots.push({ start: day.slots.at(-1)?.end ?? '', end: '' });
		void focus(`[data-slot="${slotKey(day.date, day.slots.length - 1)}"]`);
	}

	function removeSlot(day: DraftDay, index: number) {
		day.slots.splice(index, 1);
		void focus(`[data-add="${day.date}"]`);
	}

	function removeDay(date: string) {
		onremove(date);
		heading?.focus();
	}

	function copyToAll(day: DraftDay) {
		days = copySlots(days, day.date);
		announcement = t('form.timesCopied');
	}
</script>

<div class="days" bind:this={list}>
	<h3 bind:this={heading} tabindex="-1">{t('form.selectedDates', { count: days.length })}</h3>
	{#if days.length === 0}
		<p class="muted">{t('form.noDates')}</p>
	{:else}
		<ul>
			{#each days as day (day.date)}
				{@const label = formatDate(day.date, i18n.locale, 'long')}
				<li role="group" aria-labelledby="{id}-{day.date}">
					<div class="head">
						<h4 id="{id}-{day.date}">{formatDate(day.date, i18n.locale)}</h4>
						<Button
							variant="quiet"
							size="small"
							aria-label={t('form.removeDate', { date: label })}
							onclick={() => removeDay(day.date)}
						>
							<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"
								><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="2" /></svg
							>
						</Button>
					</div>

					{#if day.slots.length === 0}
						<p class="muted">{t('form.wholeDay')}</p>
					{:else}
						{#each day.slots as slot, index (index)}
							{@const key = slotKey(day.date, index)}
							{@const error = errors?.[key]}
							<div class="slot">
								<label>
									<span>{t('form.start')}</span>
									<input
										type="time"
										data-slot={key}
										bind:value={slot.start}
										aria-invalid={error !== undefined || undefined}
										aria-describedby={error === undefined ? undefined : `${id}-${key}-error`}
									/>
								</label>
								<label>
									<span>{t('form.end')}</span>
									<input
										type="time"
										bind:value={slot.end}
										aria-describedby={endsNextDay(slot) ? `${id}-${key}-next` : undefined}
									/>
								</label>
								<Button
									variant="quiet"
									size="small"
									aria-label={t('form.removeTime', { number: index + 1, date: label })}
									onclick={() => removeSlot(day, index)}
								>
									<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"
										><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="2" /></svg
									>
								</Button>
							</div>
							{#if endsNextDay(slot)}
								<p id="{id}-{key}-next" class="next-day">{t('form.endsNextDay')}</p>
							{/if}
							{#if error !== undefined}
								<p id="{id}-{key}-error" class="error">{t(error)}</p>
							{/if}
						{/each}
					{/if}

					<div class="actions">
						<Button size="small" data-add={day.date} onclick={() => addSlot(day)}>
							{day.slots.length === 0 ? t('form.addTime') : t('form.addAnotherTime')}
						</Button>
						{#if day.slots.length > 0 && days.length > 1}
							<Button size="small" variant="quiet" onclick={() => copyToAll(day)}>
								{t('form.copyTimes')}
							</Button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="visually-hidden" role="status">{announcement}</p>
</div>

<style>
	h3 {
		margin-bottom: var(--space-2);
		font-size: 1rem;
	}

	h4 {
		margin: 0;
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
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-small);
		background: var(--color-surface-soft);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.muted {
		margin: 0;
		color: var(--color-muted);
	}

	.slot {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		align-items: end;
		gap: var(--space-2);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.next-day {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.error {
		margin: 0;
		color: var(--color-danger);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
