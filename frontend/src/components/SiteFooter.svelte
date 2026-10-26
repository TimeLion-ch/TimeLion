<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import { link } from '../lib/router.svelte';

	const year = new Date().getFullYear();
</script>

<footer>
	<div class="container">
		<span>{t('footer.copyright', { year })}</span>
		<span class="links">
			<a href="/privacy" use:link>{t('footer.privacy')}</a>
			<a href="https://github.com/xLion-ch/TimeLion" rel="noreferrer" target="_blank">{t('footer.source')}</a>
		</span>
	</div>
</footer>

<style>
	footer {
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	div,
	.links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		padding-block: var(--space-4);
	}
</style>
