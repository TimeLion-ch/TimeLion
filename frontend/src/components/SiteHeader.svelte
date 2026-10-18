<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import { link } from '../lib/router.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import Logo from './Logo.svelte';
</script>

<header>
	<nav class="container" aria-label={t('nav.main')}>
		<a class="brand" href="/" use:link>
			<Logo size={40} />
			<span>{t('app.name')}</span>
		</a>
		<LanguageSwitcher />
	</nav>
</header>

<style>
	header {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-block: var(--space-3);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-primary);
		font-size: 1.25rem;
		font-weight: 800;
		text-decoration: none;
	}
</style>
