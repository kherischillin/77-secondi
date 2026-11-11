<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';

	let { data }: PageProps = $props();
	const FILTERS = [
		['da-assegnare', 'Da assegnare'],
		['miei', 'Seguiti da me'],
		['aperti', 'Tutti gli aperti'],
		['chiusi', 'Chiusi']
	] as const;
</script>

<svelte:head><title>Esiti · Spazio Master</title></svelte:head>

<nav class="filters" aria-label="Filtro">
	{#each FILTERS as [value, label] (value)}
		<a href="?filtro={value}" class:active={data.filter === value}>{label}</a>
	{/each}
</nav>

{#if data.esiti.length === 0}
	<p class="muted">Nessun esito qui.</p>
{:else}
	<ul class="list">
		{#each data.esiti as e (e.id)}
			<li class:unread={e.unread}>
				<a href="/esiti/{e.id}">
					<span class="title">
						{e.title}
						{#if e.unread}<span class="new">novità</span>{/if}
						{#if e.ownCharacter}<span class="badge">tuo personaggio</span>{/if}
					</span>
					<span class="muted small">
						{e.character} · {e.master ? `Master: ${e.master}` : 'non assegnato'} · {formatDateTime(e.lastActivityAt)}
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
		flex-wrap: wrap;
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
	.unread a {
		border-left: 3px solid var(--accent);
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
	.new {
		font-size: 0.72rem;
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 999px;
		padding: 0 0.5rem;
		font-weight: 700;
	}
	.small {
		font-size: 0.85rem;
	}
</style>
