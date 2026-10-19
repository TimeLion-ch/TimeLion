<script lang="ts">
	import SiteFooter from './components/SiteFooter.svelte';
	import SiteHeader from './components/SiteHeader.svelte';
	import { router } from './lib/router.svelte';
	import CreatePoll from './routes/CreatePoll.svelte';
	import Home from './routes/Home.svelte';
	import NotFound from './routes/NotFound.svelte';
	import PollPage from './routes/PollPage.svelte';
</script>

<SiteHeader />

<main id="main" class="container">
	{#if router.route.name === 'home'}
		<Home />
	{:else if router.route.name === 'new'}
		<CreatePoll />
	{:else if router.route.name === 'poll'}
		{#key `${router.route.id}${router.hash}`}
			<PollPage id={router.route.id} hash={router.hash} />
		{/key}
	{:else}
		<NotFound />
	{/if}
</main>

<SiteFooter />

<style>
	main {
		flex: 1;
		padding-block: var(--space-5);
	}
</style>
