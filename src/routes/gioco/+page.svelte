<script lang="ts">
	import type { PageProps } from './$types';
	import { fullName } from '#lib/format.ts';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>In gioco · {data.siteName}</title></svelte:head>

<h1>Benvenuto, {fullName(data.playing)}</h1>

<div class="card stack">
	<p>
		Il mondo di gioco è ancora in costruzione. Nella prossima fase qui troverai la mappa,
		i luoghi e la chat in tempo reale.
	</p>
	<p><a href="/account">Cambia personaggio</a></p>
</div>
