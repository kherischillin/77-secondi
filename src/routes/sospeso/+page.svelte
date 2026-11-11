<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';

	let { data }: PageProps = $props();
</script>

<h1>Account sospeso</h1>
<div class="alert error">
	Il tuo account è sospeso fino al <strong>{formatDateTime(data.until)}</strong>.
	{#if data.reason}<br />Motivo: {data.reason}{/if}
</div>
<p class="muted">Per chiarimenti contatta lo staff del gioco.</p>
