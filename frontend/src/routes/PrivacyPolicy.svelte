<script lang="ts">
	import Button from '../components/Button.svelte';
	import Notice from '../components/Notice.svelte';
	import { api } from '../lib/api';
	import { loadProblem, type LoadProblem } from '../lib/errors';
	import { i18n, t } from '../lib/i18n.svelte';
	import { parseMarkup, type Block, type Inline } from '../lib/markup';

	/** The privacy policy: German text from the server's config.php (`privacy_policy`), rendered as text. */
	let blocks = $state<Block[] | null>(null);
	let problem = $state<LoadProblem | null>(null);
	let loading = $state(false);

	async function load() {
		loading = true;
		try {
			const { text } = await api.privacyPolicy();
			blocks = parseMarkup(text);
			problem = null;
		} catch (error) {
			problem = loadProblem(error);
		} finally {
			loading = false;
		}
	}

	void load();
</script>

{#snippet inline(content: Inline[])}
	{#each content as part, index (index)}{#if part.href === undefined}{part.text}{:else}<a
				href={part.href}
				rel="noreferrer">{part.text}</a
			>{/if}{/each}
{/snippet}

<svelte:head>
	<title>{t('privacy.title')} · {t('app.name')}</title>
</svelte:head>

<article>
	<h1>{t('privacy.title')}</h1>

	{#if problem === 'notFound'}
		<p>{t('privacy.missing')}</p>
	{:else if problem !== null}
		<Notice kind="error" role="alert">
			<p>{t(problem === 'network' ? 'error.network' : 'error.generic')}</p>
		</Notice>
		<div>
			<Button variant="primary" busy={loading} onclick={load}>{t('poll.retry')}</Button>
		</div>
	{:else if blocks === null}
		<p role="status">{t('privacy.loading')}</p>
	{:else}
		{#if i18n.locale !== 'de'}
			<Notice><p>{t('privacy.germanOnly')}</p></Notice>
		{/if}
		<div class="text" lang="de">
			{#each blocks as block, index (index)}
				{#if block.type === 'heading' && block.level === 2}
					<h2>{@render inline(block.content)}</h2>
				{:else if block.type === 'heading'}
					<h3>{@render inline(block.content)}</h3>
				{:else if block.type === 'paragraph'}
					<p>{@render inline(block.content)}</p>
				{:else}
					<ul>
						{#each block.items as item, itemIndex (itemIndex)}
							<li>{@render inline(item)}</li>
						{/each}
					</ul>
				{/if}
			{/each}
		</div>
	{/if}
</article>

<style>
	article {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 44rem;
		margin-inline: auto;
		/* German compounds ("Datenschutzerklärung") are wider than a phone; the text is lang="de". */
		hyphens: auto;
		overflow-wrap: break-word;
	}

	h1,
	article > p {
		margin: 0;
	}

	.text {
		overflow-wrap: anywhere;
	}

	.text h2 {
		margin-top: var(--space-5);
		font-size: 1.25rem;
	}

	.text h3 {
		margin-top: var(--space-4);
		font-size: 1.0625rem;
	}

	.text > :first-child {
		margin-top: 0;
	}

	/* Line breaks within a paragraph are part of the text, e.g. in an address (markup.ts). */
	.text p {
		white-space: pre-line;
	}

	.text ul {
		margin: 0 0 var(--space-3);
		padding-left: var(--space-4);
	}

	.text li + li {
		margin-top: var(--space-1);
	}
</style>
