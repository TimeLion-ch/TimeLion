<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import { adminLink, participantLink } from '../lib/links';
	import Button from './Button.svelte';
	import CopyField from './CopyField.svelte';
	import Notice from './Notice.svelte';

	/** Shown once, right after a poll was created: the two links, which nobody can recover. */
	type Props = {
		id: string;
		pollKey: string;
		adminToken: string;
		ondone: () => void;
	};

	let { id, pollKey, adminToken, ondone }: Props = $props();
</script>

<section class="share" aria-labelledby="share-title">
	<h1 id="share-title">{t('share.title')}</h1>
	<p class="lead">{t('share.lead')}</p>

	<Notice kind="warning" title={t('share.warningTitle')}>
		<p>{t('share.warning')}</p>
	</Notice>

	<CopyField
		label={t('share.participantLink')}
		hint={t('share.participantHint')}
		value={participantLink(location.origin, id, pollKey)}
	/>
	<CopyField
		label={t('share.adminLink')}
		hint={t('share.adminHint')}
		value={adminLink(location.origin, id, pollKey, adminToken)}
	/>

	<div>
		<Button variant="primary" onclick={ondone}>{t('share.done')}</Button>
	</div>
</section>

<style>
	.share {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 44rem;
		margin-inline: auto;
	}

	h1,
	.lead {
		margin: 0;
	}

	.lead {
		color: var(--color-muted);
	}
</style>
