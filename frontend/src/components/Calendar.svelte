<script lang="ts">
	import { tick } from 'svelte';
	import { addDays, addMonths, monthGrid, monthOf, weekday } from '../lib/dates';
	import { formatDate, formatMonth, weekdayNames } from '../lib/format';
	import { i18n, t } from '../lib/i18n.svelte';

	/**
	 * A month calendar for picking several dates (`YYYY-MM-DD`). Keyboard: arrow keys move by day and week, Home and
	 * End to the start and end of the week, Page Up and Page Down by month; Enter or Space toggles the date. Only the
	 * focused date is in the tab order.
	 */
	type Props = {
		selected: readonly string[];
		ontoggle: (date: string) => void;
		today: string;
		/** Earlier dates can't be picked. */
		min?: string;
		/** Later dates can't be picked. */
		max?: string;
		/** The accessible description, e.g. the id of a hint or error. */
		describedby?: string | undefined;
	};

	let { selected, ontoggle, today, min, max, describedby }: Props = $props();

	const id = $props.id();
	// The calendar opens at the first selected date, or today; after that it follows the user.
	// svelte-ignore state_referenced_locally
	const start = selected[0] ?? (min !== undefined && min > today ? min : today);
	let focused = $state(start);
	let month = $state(monthOf(start));
	let grid: HTMLTableElement | undefined = $state();

	const weeks = $derived(monthGrid(month));
	const shortNames = $derived(weekdayNames(i18n.locale, 'short'));
	const longNames = $derived(weekdayNames(i18n.locale, 'long'));
	const firstMonth = $derived(min === undefined ? undefined : monthOf(min));
	const lastMonth = $derived(max === undefined ? undefined : monthOf(max));

	/** Dates out of range can't be picked, but a date that is already selected can always be removed. */
	function blocked(date: string): boolean {
		return ((min !== undefined && date < min) || (max !== undefined && date > max)) && !selected.includes(date);
	}

	/** Moves the focus, showing the date's month; dates beyond the first or last month are clamped. */
	async function moveTo(date: string, focus: boolean) {
		if (firstMonth !== undefined && date < `${firstMonth}-01`) {
			date = `${firstMonth}-01`;
		}
		if (lastMonth !== undefined && date > addDays(`${addMonths(lastMonth, 1)}-01`, -1)) {
			date = addDays(`${addMonths(lastMonth, 1)}-01`, -1);
		}
		focused = date;
		month = monthOf(date);
		if (focus) {
			await tick();
			grid?.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)?.focus();
		}
	}

	/** Same day in another month, or its last day if the month is shorter. */
	function shiftMonth(date: string, months: number): string {
		const target = addMonths(date, months);
		const lastDay = addDays(`${addMonths(target, 1)}-01`, -1);
		const candidate = `${target}-${date.slice(8)}`;
		return candidate > lastDay ? lastDay : candidate;
	}

	function onkeydown(event: KeyboardEvent) {
		const moves: Record<string, () => string> = {
			ArrowLeft: () => addDays(focused, -1),
			ArrowRight: () => addDays(focused, 1),
			ArrowUp: () => addDays(focused, -7),
			ArrowDown: () => addDays(focused, 7),
			Home: () => addDays(focused, -weekday(focused)),
			End: () => addDays(focused, 6 - weekday(focused)),
			PageUp: () => shiftMonth(focused, event.shiftKey ? -12 : -1),
			PageDown: () => shiftMonth(focused, event.shiftKey ? 12 : 1),
		};
		const move = moves[event.key];
		if (move === undefined || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		event.preventDefault();
		void moveTo(move(), true);
	}

	function toggle(date: string) {
		focused = date;
		if (!blocked(date)) {
			ontoggle(date);
		}
	}
</script>

<div class="calendar">
	<div class="head">
		<button
			type="button"
			class="nav"
			aria-label={t('calendar.previousMonth')}
			disabled={firstMonth !== undefined && month <= firstMonth}
			onclick={() => moveTo(shiftMonth(focused, -1), false)}
		>
			<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"
				><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="2" /></svg
			>
		</button>
		<h3 id="{id}-month" aria-live="polite">{formatMonth(month, i18n.locale)}</h3>
		<button
			type="button"
			class="nav"
			aria-label={t('calendar.nextMonth')}
			disabled={lastMonth !== undefined && month >= lastMonth}
			onclick={() => moveTo(shiftMonth(focused, 1), false)}
		>
			<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"
				><path d="m7.5 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" /></svg
			>
		</button>
	</div>

	<table bind:this={grid} role="grid" aria-labelledby="{id}-month" aria-describedby={describedby} {onkeydown}>
		<thead>
			<tr>
				{#each shortNames as name, index (index)}
					<th scope="col" abbr={longNames[index]}>{name}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each weeks as week, row (row)}
				<tr>
					{#each week as date, column (column)}
						<td>
							{#if date !== null}
								<button
									type="button"
									data-date={date}
									class:today={date === today}
									tabindex={date === focused ? 0 : -1}
									aria-label={formatDate(date, i18n.locale, 'long')}
									aria-pressed={selected.includes(date)}
									aria-disabled={blocked(date) || undefined}
									aria-current={date === today ? 'date' : undefined}
									onclick={() => toggle(date)}
									onfocus={() => (focused = date)}
								>
									{Number(date.slice(8))}
								</button>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.calendar {
		max-width: 24rem;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	h3 {
		margin: 0;
		font-size: 1.0625rem;
		text-align: center;
	}

	.nav {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.nav:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	th {
		padding-bottom: var(--space-1);
		color: var(--color-muted);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	td {
		padding: 2px;
		text-align: center;
	}

	td button {
		width: 100%;
		max-width: 3rem;
		aspect-ratio: 1;
		border: 1px solid transparent;
		border-radius: 999px;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	td button:hover {
		border-color: var(--color-border-strong);
	}

	td button.today {
		border-color: var(--color-primary);
		font-weight: 800;
	}

	td button[aria-pressed='true'] {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: var(--color-primary-contrast);
		font-weight: 700;
	}

	td button[aria-disabled='true'] {
		color: var(--color-muted);
		text-decoration: line-through;
		cursor: not-allowed;
	}

	td button[aria-disabled='true']:hover {
		border-color: transparent;
	}
</style>
