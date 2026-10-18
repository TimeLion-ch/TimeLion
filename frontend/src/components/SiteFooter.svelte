<script lang="ts">
	import { t } from '../lib/i18n.svelte';

	const year = new Date().getFullYear();
</script>

<footer>
	<div class="container">
		<span>{t('footer.copyright', { year })}</span>
		<a href="https://github.com/TimeLion-ch/TimeLion" rel="noreferrer" target="_blank">{t('footer.source')}</a>
	</div>
</footer>

<style>
	footer {
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		padding-block: var(--space-4);
	}
</style>
