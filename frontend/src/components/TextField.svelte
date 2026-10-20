<script lang="ts">
	import { t } from '../lib/i18n.svelte';

	type Props = {
		label: string;
		value: string;
		type?: 'text' | 'date' | 'time';
		multiline?: boolean;
		rows?: number;
		required?: boolean;
		/** Adds "(optional)" to the label. */
		optional?: boolean;
		maxlength?: number;
		min?: string;
		max?: string;
		autocomplete?: 'off' | 'name';
		/** The on-screen keyboard, e.g. digits only. */
		inputmode?: 'numeric';
		hint?: string;
		/** Marks the field invalid and is read out with it. */
		error?: string | undefined;
		/** For focusing the field, e.g. the first invalid one. */
		element?: HTMLInputElement | HTMLTextAreaElement | undefined;
	};

	let {
		label,
		value = $bindable(),
		type = 'text',
		multiline = false,
		rows = 3,
		required = false,
		optional = false,
		maxlength,
		min,
		max,
		autocomplete,
		inputmode,
		hint,
		error,
		element = $bindable(),
	}: Props = $props();

	const uid = $props.id();
	const id = `field-${uid}`;
	const describedBy = $derived(
		[hint === undefined ? null : `${id}-hint`, error === undefined ? null : `${id}-error`]
			.filter((part) => part !== null)
			.join(' ') || undefined,
	);
</script>

<div class="field">
	<label for={id}>
		{label}
		{#if optional}<span class="optional">({t('form.optional')})</span>{/if}
	</label>
	{#if hint !== undefined}
		<p id="{id}-hint" class="hint">{hint}</p>
	{/if}
	{#if multiline}
		<textarea
			{id}
			bind:this={element}
			bind:value
			{rows}
			{required}
			{maxlength}
			aria-invalid={error !== undefined || undefined}
			aria-describedby={describedBy}
		></textarea>
	{:else}
		<input
			{id}
			bind:this={element}
			bind:value
			{type}
			{required}
			{maxlength}
			{min}
			{max}
			{autocomplete}
			{inputmode}
			aria-invalid={error !== undefined || undefined}
			aria-describedby={describedBy}
		/>
	{/if}
	{#if error !== undefined}
		<p id="{id}-error" class="error">{error}</p>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	label {
		font-weight: 700;
	}

	.optional,
	.hint {
		color: var(--color-muted);
		font-weight: 400;
	}

	.hint,
	.error {
		margin: 0;
		font-size: 0.875rem;
	}

	.error {
		color: var(--color-danger);
		font-weight: 600;
	}
</style>
