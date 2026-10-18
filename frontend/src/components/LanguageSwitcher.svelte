<script lang="ts">
	import { locales } from '../lib/i18n';
	import { i18n, t } from '../lib/i18n.svelte';
</script>

<div class="switcher" role="group" aria-label={t('language.label')}>
	{#each locales as locale (locale)}
		<button
			type="button"
			lang={locale}
			title={t(`language.${locale}`)}
			aria-pressed={i18n.locale === locale}
			onclick={() => (i18n.locale = locale)}
		>
			{locale.toUpperCase()}
		</button>
	{/each}
</div>

<style>
	.switcher {
		display: inline-flex;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		overflow: hidden;
	}

	button {
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 700;
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
	}

	button[aria-pressed='true'] {
		background: var(--color-primary);
		color: var(--color-primary-contrast);
	}
</style>
