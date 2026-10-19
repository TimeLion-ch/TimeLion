<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '../lib/i18n.svelte';
	import Button from './Button.svelte';

	/** A button for something that can't be undone: it asks again, next to itself, before doing it. */
	type Props = {
		label: string;
		/** The accessible name of the first button, if `label` alone is ambiguous (e.g. in a list). */
		ariaLabel?: string;
		question: string;
		confirmLabel: string;
		size?: 'normal' | 'small';
		busy?: boolean;
		onconfirm: () => void | Promise<void>;
	};

	let { label, ariaLabel, question, confirmLabel, size = 'normal', busy = false, onconfirm }: Props = $props();

	let open = $state(false);
	let box: HTMLElement | undefined = $state();

	async function show(next: boolean) {
		open = next;
		await tick();
		box?.querySelector<HTMLButtonElement>(next ? 'button.danger' : 'button')?.focus();
	}

	async function confirm() {
		await onconfirm();
		open = false;
	}
</script>

<span class="confirm" bind:this={box}>
	{#if open}
		<span class="question" role="group" aria-label={question}>
			<span aria-hidden="true">{question}</span>
			<Button variant="danger" {size} {busy} onclick={confirm}>{confirmLabel}</Button>
			<Button {size} onclick={() => show(false)}>{t('common.cancel')}</Button>
		</span>
	{:else}
		<Button variant="danger" {size} aria-label={ariaLabel} onclick={() => show(true)}>{label}</Button>
	{/if}
</span>

<style>
	.confirm,
	.question {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.question > span {
		font-weight: 700;
	}
</style>
