<script lang="ts">
	import PollForm from '../components/PollForm.svelte';
	import { browserTimeZone, todayIn } from '../lib/dates';
	import { deviceStore } from '../lib/deviceStore';
	import { errorMessage } from '../lib/errors';
	import { t, type MessageKey } from '../lib/i18n.svelte';
	import { adminLink } from '../lib/links';
	import { buildPoll, emptyDraft, expiresAt, type PollDraft } from '../lib/pollDraft';
	import { createPoll } from '../lib/polls';
	import { navigate } from '../lib/router.svelte';

	const timezone = browserTimeZone();
	const today = todayIn(timezone);

	let draft = $state(emptyDraft(timezone, today));
	let busy = $state(false);
	let error: MessageKey | undefined = $state();

	async function create(submitted: PollDraft) {
		busy = true;
		error = undefined;
		try {
			const poll = buildPoll(submitted);
			const created = await createPoll(poll, expiresAt(submitted, Math.floor(Date.now() / 1000)));
			deviceStore.savePoll(created.id, created.key, { adminToken: created.adminToken, title: poll.title });
			const url = new URL(adminLink(location.origin, created.id, created.key, created.adminToken));
			navigate(url.pathname + url.hash, { state: { created: true } });
		} catch (caught) {
			error = errorMessage(caught);
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{t('create.title')} · {t('app.name')}</title>
</svelte:head>

<div class="page">
	<h1>{t('create.title')}</h1>
	<p class="lead">{t('create.lead')}</p>
	<PollForm bind:draft {today} submitLabel={t('create.submit')} {busy} error={error && t(error)} onsubmit={create} />
</div>

<style>
	.page {
		max-width: 52rem;
		margin-inline: auto;
	}

	.lead {
		color: var(--color-muted);
	}
</style>
