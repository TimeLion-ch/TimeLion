<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import { link, router } from '../lib/router.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import Logo from './Logo.svelte';
</script>

<header>
	<nav class="container" aria-label={t('nav.main')}>
		<a class="brand" href="/" use:link>
			<Logo size={40} />
			<span class="name">{t('app.name')}</span>
		</a>
		<div class="end">
			<a class="my" href="/my" use:link aria-current={router.route.name === 'my' ? 'page' : undefined}>
				{t('nav.myPolls')}
			</a>
			<LanguageSwitcher />
		</div>
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

	.end {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.my {
		font-weight: 700;
		text-decoration: none;
	}

	.my:hover,
	.my[aria-current='page'] {
		text-decoration: underline;
		text-underline-offset: 0.25em;
	}

	/* On narrow screens the logo alone stands for the name; screen readers still get it. */
	@media (max-width: 25rem) {
		.name {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
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
