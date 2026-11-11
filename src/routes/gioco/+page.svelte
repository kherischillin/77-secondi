<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>In gioco · {data.siteName}</title></svelte:head>

<h1>Il mondo è ancora vuoto</h1>
<div class="card stack">
	<p>Non è stata creata ancora nessuna mappa, quindi non c'è un posto dove giocare.</p>
	{#if data.canBuild}
		<p><a class="button" href="/gestione/mondo">Crea la prima mappa</a></p>
	{:else}
		<p class="muted">Lo staff sta preparando il mondo: torna presto.</p>
	{/if}
</div>
