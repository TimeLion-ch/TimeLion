<script lang="ts">
	import ShareScreen from '../components/ShareScreen.svelte';
	import { parseFragment } from '../lib/links';
	import { replaceState, router } from '../lib/router.svelte';
	import NotFound from './NotFound.svelte';

	let { id }: { id: string } = $props();

	const fragment = parseFragment(location.hash);

	function dismissShare() {
		replaceState({});
		window.scrollTo(0, 0);
	}
</script>

{#if router.state.created && fragment?.adminToken !== undefined}
	<ShareScreen {id} pollKey={fragment.key} adminToken={fragment.adminToken} ondone={dismissShare} />
{:else}
	<NotFound />
{/if}
