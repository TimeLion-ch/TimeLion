<script lang="ts">
	import { downloadFile, fileName } from '../lib/download';
	import { resultSheet, toCsv } from '../lib/export';
	import { i18n, t } from '../lib/i18n.svelte';
	import type { Poll } from '../lib/model';
	import type { LoadedResponse } from '../lib/polls';
	import { buildXlsx, XLSX_TYPE } from '../lib/xlsx';
	import Button from './Button.svelte';

	/** Downloads the options, votes and comments as a spreadsheet, built in this browser. */
	let { poll, responses }: { poll: Poll; responses: LoadedResponse[] } = $props();

	function sheet() {
		return resultSheet(
			poll,
			responses.map((entry) => entry.response),
			i18n.locale,
			t,
		);
	}

	function downloadExcel() {
		downloadFile(fileName(poll.title, 'xlsx'), buildXlsx(sheet(), t('export.sheet')), XLSX_TYPE);
	}

	function downloadCsv() {
		downloadFile(fileName(poll.title, 'csv'), toCsv(sheet()), 'text/csv;charset=utf-8');
	}
</script>

<div class="export">
	<div class="buttons">
		<Button size="small" onclick={downloadExcel}>{t('export.excel')}</Button>
		<Button size="small" onclick={downloadCsv}>{t('export.csv')}</Button>
	</div>
	<p class="hint">{t('export.hint')}</p>
</div>

<style>
	.export {
		margin-top: var(--space-4);
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.hint {
		margin: var(--space-2) 0 0;
		color: var(--color-muted);
		font-size: 0.875rem;
	}
</style>
