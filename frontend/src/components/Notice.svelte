<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		kind?: 'info' | 'success' | 'warning' | 'error';
		/** `alert` for errors that appear after an action, `status` for other news; none for static text. */
		role?: 'alert' | 'status';
		title?: string;
		/** For moving focus to the notice, e.g. an error summary after submitting. */
		element?: HTMLDivElement | undefined;
		children?: Snippet;
	};

	let { kind = 'info', role, title, element = $bindable(), children }: Props = $props();
</script>

<div bind:this={element} class={['notice', kind]} {role} tabindex="-1">
	{#if title !== undefined}
		<p class="title">{title}</p>
	{/if}
	{@render children?.()}
</div>

<style>
	.notice {
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-left-width: 0.375rem;
		border-radius: var(--radius-small);
		background: var(--color-surface-soft);
	}

	.notice:focus {
		outline: none;
	}

	.notice:focus-visible {
		outline: 3px solid var(--color-focus);
	}

	.notice :global(p:last-child) {
		margin-bottom: 0;
	}

	.title {
		font-weight: 700;
	}

	.info {
		border-left-color: var(--color-primary);
	}

	.success {
		border-color: var(--color-success);
		background: var(--color-success-soft);
	}

	.warning {
		border-color: var(--color-warning);
		background: var(--color-warning-soft);
	}

	.error {
		border-color: var(--color-danger);
		background: var(--color-danger-soft);
	}
</style>
