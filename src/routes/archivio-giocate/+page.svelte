<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDate } from '#lib/format.ts';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Archivio giocate</title></svelte:head>

<h1>Archivio giocate</h1>
<p class="muted">Le giocate registrate che i giocatori hanno scelto di rendere pubbliche: la storia del gioco, da leggere.</p>

{#if data.giocate.length === 0}
	<p class="muted">Nessuna giocata pubblica, per ora.</p>
{:else}
	<ul class="list card">
		{#each data.giocate as g (g.id)}
			<li>
				<a href="/giocate/{g.id}">{g.title}</a>
				<span class="muted small">{g.locationName} · {formatDate(g.fromAt)} · {g.people} {g.people === 1 ? 'personaggio' : 'personaggi'}</span>
			</li>
		{/each}
	</ul>
	<nav class="pager" aria-label="Pagine">
		{#if data.page > 1}<a href="?pagina={data.page - 1}">← Più recenti</a>{/if}
		{#if data.hasMore}<a href="?pagina={data.page + 1}">Meno recenti →</a>{/if}
	</nav>
{/if}

<style>
	.list {
		list-style: none;
		padding: 0.5rem 1rem;
	}
	.list li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		flex-wrap: wrap;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
	}
	.list li:last-child {
		border-bottom: 0;
	}
	.small {
		font-size: 0.85rem;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem;
	}
</style>
