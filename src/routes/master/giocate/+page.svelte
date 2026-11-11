<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Giocate da rivedere · Spazio Master</title></svelte:head>

<nav class="filters" aria-label="Filtro">
	<a href="?filtro=da-rivedere" class:active={data.filter === 'da-rivedere'}>Da rivedere</a>
	<a href="?filtro=riviste" class:active={data.filter === 'riviste'}>Già riviste</a>
</nav>

{#if data.giocate.length === 0}
	<p class="muted">{data.filter === 'da-rivedere' ? 'Nessuna giocata in attesa di revisione.' : 'Nessuna giocata rivista.'}</p>
{:else}
	<ul class="list">
		{#each data.giocate as g (g.id)}
			<li>
				<a href="/giocate/{g.id}">
					<strong>{g.title}</strong>
					<span class="muted small">
						{g.locationName} · {formatDateTime(g.fromAt)} · {g.participants} partecipant{g.participants === 1 ? 'e' : 'i'} ·
						{g.reviewedAt ? `rivista il ${formatDateTime(g.reviewedAt)}` : `inviata il ${formatDateTime(g.reviewRequestedAt)}`}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.filters {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.filters a {
		padding: 0.3rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		text-decoration: none;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.filters a.active {
		border-color: var(--accent);
		color: var(--accent);
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.list a {
		display: grid;
		gap: 0.15rem;
		padding: 0.75rem 1rem;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}
	.list a:hover {
		border-color: var(--accent);
	}
	.small {
		font-size: 0.85rem;
	}
</style>
