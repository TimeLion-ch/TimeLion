<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import { link } from '../lib/router.svelte';
</script>

<svelte:head>
	<title>{t('notFound.title')} · {t('app.name')}</title>
</svelte:head>

<section>
	<h1>{t('notFound.title')}</h1>
	<p>{t('notFound.text')}</p>
	<a href="/" use:link>{t('notFound.back')}</a>
</section>

<style>
	section {
		max-width: 40rem;
		margin-inline: auto;
		text-align: center;
	}
</style>
