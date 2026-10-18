<script lang="ts">
	import Logo from '../components/Logo.svelte';
	import { t } from '../lib/i18n.svelte';

	const features = [
		{ title: 'home.feature.encrypted.title', text: 'home.feature.encrypted.text' },
		{ title: 'home.feature.noAccount.title', text: 'home.feature.noAccount.text' },
		{ title: 'home.feature.expiry.title', text: 'home.feature.expiry.text' },
	] as const;
</script>

<svelte:head>
	<title>{t('app.name')}</title>
</svelte:head>

<section class="hero">
	<Logo size={112} />
	<h1>{t('home.title')}</h1>
	<p class="lead">{t('home.lead')}</p>
	<p class="notice" role="status">{t('home.comingSoon')}</p>
</section>

<section aria-labelledby="features-title">
	<h2 id="features-title" class="visually-hidden">{t('home.features.title')}</h2>
	<ul class="features">
		{#each features as feature (feature.title)}
			<li>
				<h3>{t(feature.title)}</h3>
				<p>{t(feature.text)}</p>
			</li>
		{/each}
	</ul>
</section>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		max-width: 44rem;
		margin: 0 auto var(--space-6);
	}

	h1 {
		margin-top: var(--space-4);
		font-size: clamp(1.75rem, 1.2rem + 2.5vw, 2.75rem);
	}

	.lead {
		color: var(--color-muted);
		font-size: 1.125rem;
	}

	.notice {
		margin-top: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius);
		background: var(--color-surface-soft);
		font-weight: 600;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.features li {
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	.features h3 {
		font-size: 1.125rem;
		color: var(--color-primary);
	}

	.features p {
		margin: 0;
		color: var(--color-muted);
	}
</style>
