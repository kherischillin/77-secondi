<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Giocate · {data.siteName}</title></svelte:head>

<h1>Le mie giocate</h1>
<p class="muted">Giocate registrate a cui hanno partecipato i tuoi personaggi. Si registrano dalla chat di un luogo, con "Registra la giocata".</p>

{#if data.giocate.length === 0}
	<p class="muted">Nessuna giocata registrata.</p>
{:else}
	<ul class="list">
		{#each data.giocate as g (g.id)}
			<li>
				<a href="/giocate/{g.id}">
					<span class="title">
						{g.title}
						{#if g.isPublic}<span class="badge">pubblica</span>{/if}
						{#if g.reviewedAt}<span class="badge accent">rivista</span>{:else if g.reviewRequestedAt}<span class="badge">inviata ai Master</span>{/if}
					</span>
					<span class="muted small">{g.locationName} · {formatDateTime(g.fromAt)}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
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
	.title {
		font-weight: 600;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.badge {
		margin: 0;
	}
	.small {
		font-size: 0.85rem;
	}
</style>
