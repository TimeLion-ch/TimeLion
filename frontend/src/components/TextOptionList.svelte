<script lang="ts">
	import { tick } from 'svelte';
	import { t, type MessageKey } from '../lib/i18n.svelte';
	import { limits } from '../lib/model';
	import type { DraftText } from '../lib/pollDraft';
	import Button from './Button.svelte';

	/** The options of a text poll in the poll form: add, edit, remove, and move up or down (no drag and drop). */
	type Props = {
		texts: DraftText[];
		/** By the index in `texts`. */
		errors?: Record<number, MessageKey> | undefined;
		/** The ID of an error about the whole list, for the add button. */
		describedby?: string | undefined;
	};

	let { texts = $bindable(), errors, describedby }: Props = $props();

	const id = $props.id();
	let list: HTMLElement | undefined = $state();
	let announcement = $state('');

	async function focus(selector: string) {
		await tick();
		list?.querySelector<HTMLElement>(selector)?.focus();
	}

	function add() {
		texts.push({ text: '' });
		void focus(`[data-text="${texts.length - 1}"]`);
	}

	function remove(index: number) {
		texts.splice(index, 1);
		announcement = t('form.optionRemoved');
		void focus(index < texts.length ? `[data-text="${index}"]` : '[data-add]');
	}

	/** Focus stays on the moved option: on the same button, or on the other one once it reaches an end. */
	function move(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		const moved = texts[index];
		const other = texts[target];
		if (moved === undefined || other === undefined) {
			return;
		}
		texts[target] = moved;
		texts[index] = other;
		announcement = t('form.optionMoved', { number: target + 1 });
		const atEnd = direction === 'up' ? target === 0 : target === texts.length - 1;
		const button = atEnd ? (direction === 'up' ? 'down' : 'up') : direction;
		void focus(`[data-move="${button}-${target}"]`);
	}
</script>

<div class="texts" bind:this={list}>
	<ol>
		{#each texts as item, index (index)}
			{@const error = errors?.[index]}
			<li>
				<div class="row">
					<label for="{id}-{index}"><span class="visually-hidden">{t('form.option')}</span> {index + 1}</label
					>
					<input
						id="{id}-{index}"
						data-text={index}
						bind:value={item.text}
						maxlength={limits.optionText}
						aria-invalid={error !== undefined || undefined}
						aria-describedby={error === undefined ? undefined : `${id}-${index}-error`}
					/>
					<span class="buttons">
						<Button
							variant="quiet"
							size="small"
							data-move="up-{index}"
							aria-label={t('form.moveUp', { number: index + 1 })}
							disabled={index === 0}
							onclick={() => move(index, 'up')}
						>
							<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"
								><path
									d="M10 16V4m-5 5 5-5 5 5"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								/></svg
							>
						</Button>
						<Button
							variant="quiet"
							size="small"
							data-move="down-{index}"
							aria-label={t('form.moveDown', { number: index + 1 })}
							disabled={index === texts.length - 1}
							onclick={() => move(index, 'down')}
						>
							<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"
								><path
									d="M10 4v12m-5-5 5 5 5-5"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								/></svg
							>
						</Button>
						<Button
							variant="quiet"
							size="small"
							aria-label={t('form.removeOption', { number: index + 1 })}
							onclick={() => remove(index)}
						>
							<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"
								><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="2" /></svg
							>
						</Button>
					</span>
				</div>
				{#if error !== undefined}
					<p id="{id}-{index}-error" class="error">{t(error)}</p>
				{/if}
			</li>
		{/each}
	</ol>
	<div>
		<Button
			size="small"
			data-add
			disabled={texts.length >= limits.options}
			aria-describedby={describedby}
			onclick={add}
		>
			{t('form.addOption')}
		</Button>
	</div>
	<p class="visually-hidden" role="status">{announcement}</p>
</div>

<style>
	.texts {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	ol {
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
		gap: var(--space-1);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	label {
		flex: none;
		min-width: 1.5rem;
		color: var(--color-muted);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	input {
		flex: 1;
		min-width: 0;
	}

	.buttons {
		display: flex;
		flex: none;
	}

	/* Narrow buttons, so that the field keeps its room at 360 px. */
	.buttons :global(.button) {
		padding-inline: var(--space-2);
	}

	.error {
		margin: 0 0 0 calc(1.5rem + var(--space-2));
		color: var(--color-danger);
		font-size: 0.875rem;
		font-weight: 600;
	}
</style>
