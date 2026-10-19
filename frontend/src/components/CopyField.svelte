<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import Button from './Button.svelte';

	/** A read-only value with a copy button. Without the Clipboard API the text is selected for copying by hand. */
	type Props = {
		label: string;
		value: string;
		hint?: string;
	};

	let { label, value, hint }: Props = $props();

	const uid = $props.id();
	const id = `copy-${uid}`;
	let input: HTMLInputElement | undefined = $state();
	let status: 'copied' | 'selected' | null = $state(null);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			status = 'copied';
		} catch {
			input?.focus();
			input?.select();
			status = 'selected';
		}
	}
</script>

<div class="copy">
	<label for={id}>{label}</label>
	{#if hint !== undefined}
		<p id="{id}-hint" class="hint">{hint}</p>
	{/if}
	<div class="row">
		<input
			{id}
			bind:this={input}
			type="text"
			readonly
			{value}
			spellcheck="false"
			aria-describedby={hint === undefined ? undefined : `${id}-hint`}
			onfocus={(event) => event.currentTarget.select()}
		/>
		<Button onclick={copy}>{status === 'copied' ? t('copy.copied') : t('copy.copy')}</Button>
	</div>
	<p class="status" role="status">
		{#if status === 'copied'}{t('copy.copiedMessage')}{:else if status === 'selected'}{t('copy.selected')}{/if}
	</p>
</div>

<style>
	.copy {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	label {
		font-weight: 700;
	}

	.hint,
	.status {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	input {
		flex: 1 1 14rem;
		min-width: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.875rem;
	}
</style>
