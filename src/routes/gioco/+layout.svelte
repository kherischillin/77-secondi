<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import { fullName } from '#lib/format.ts';

	let { data, children }: LayoutProps = $props();

	const mapHref = $derived(data.currentMapId ? `/gioco/mappa/${data.currentMapId}` : '/gioco');
</script>

<nav class="gamebar" aria-label="Navigazione di gioco">
	<span class="who">In gioco come <strong>{fullName(data.playing)}</strong></span>
	<a href={mapHref} aria-current={page.url.pathname.startsWith('/gioco/mappa') ? 'page' : undefined}>Mappa</a>
	<a href="/gioco/presenti" aria-current={page.url.pathname === '/gioco/presenti' ? 'page' : undefined}>Presenti</a>
	<a href="/scheda/{data.playing.id}">La mia scheda</a>
	<a href="/inventario">Inventario</a>
	<a href="/mercato">Mercato</a>
	<a href="/banca">Banca</a>
	<a href="/esiti">Esiti</a>
	<a href="/giocate">Giocate</a>
	<a href="/account">Cambia personaggio</a>
</nav>

{@render children()}

<style>
	.gamebar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1.25rem;
		margin: -1rem 0 1.5rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
		font-size: 0.95rem;
	}
	.who {
		color: var(--text-muted);
		margin-right: auto;
	}
	.who strong {
		color: var(--text);
	}
	a {
		color: var(--text-muted);
		text-decoration: none;
	}
	a:hover,
	a[aria-current='page'] {
		color: var(--accent);
	}
</style>
