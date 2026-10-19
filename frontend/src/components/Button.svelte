<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { link } from '../lib/router.svelte';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
		size?: 'normal' | 'small';
		/** While busy the button stays focusable but ignores clicks (`aria-disabled`); a form must check this too. */
		busy?: boolean;
		/** Renders an internal link that looks like a button. */
		href?: string;
		children: Snippet;
	};

	let {
		variant = 'secondary',
		size = 'normal',
		busy = false,
		href,
		type = 'button',
		onclick,
		children,
		...rest
	}: Props = $props();

	const classes = $derived(['button', variant, size, { busy }]);
</script>

{#if href !== undefined}
	<a {href} class={classes} use:link>{@render children()}</a>
{:else}
	<button
		{type}
		class={classes}
		aria-disabled={busy || undefined}
		onclick={(event) => {
			if (busy) {
				event.preventDefault();
				return;
			}
			onclick?.(event);
		}}
		{...rest}
	>
		{@render children()}
	</button>
{/if}

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--color-primary);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-primary);
		font: inherit;
		font-weight: 700;
		line-height: 1.2;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
	}

	.button:hover {
		background: var(--color-surface-soft);
	}

	.primary {
		background: var(--color-primary);
		color: var(--color-primary-contrast);
	}

	.primary:hover {
		background: var(--color-primary);
		filter: brightness(1.1);
	}

	.danger {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	.quiet {
		border-color: transparent;
		background: transparent;
	}

	.small {
		min-height: 2.25rem;
		padding: var(--space-1) var(--space-3);
		font-size: 0.875rem;
	}

	.busy,
	.button:disabled {
		cursor: progress;
		opacity: 0.65;
	}

	.button:disabled {
		cursor: not-allowed;
	}
</style>
