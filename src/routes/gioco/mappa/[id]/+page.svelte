<script lang="ts">
	import type { PageProps } from './$types';
	import MapCanvas from '#lib/components/MapCanvas.svelte';

	let { data }: PageProps = $props();

	function hrefOf(l: (typeof data.locations)[number]) {
		return l.kind === 'map_link' && l.linkedMapId ? `/gioco/mappa/${l.linkedMapId}` : `/gioco/luogo/${l.id}`;
	}

	const markers = $derived(
		data.locations.map((l) => ({
			id: l.id,
			name: l.name,
			x: l.x,
			y: l.y,
			kind: l.kind,
			href: hrefOf(l),
			count: l.present
		}))
	);
</script>

<svelte:head><title>{data.map.name} · {data.siteName}</title></svelte:head>

<div class="head">
	<h1>{data.map.name}</h1>
	{#if data.weather}
		<p class="weather" title={data.weather.manual ? 'Meteo deciso dallo staff' : 'Meteo della zona'}>
			<span aria-hidden="true">{data.weather.icon}</span>
			{data.weather.label}{#if data.weather.temperature !== null}, {data.weather.temperature}°C{/if}
			<span class="moon"><span aria-hidden="true">{data.weather.moon.icon}</span> {data.weather.moon.name}</span>
		</p>
	{/if}
</div>
{#if data.map.description}<p class="description">{data.map.description}</p>{/if}

<div class="layout">
	{#if data.map.imageUrl}
		<MapCanvas imageUrl={data.map.imageUrl} alt="Mappa: {data.map.name}" {markers} />
	{/if}

	<section class="card">
		<h2>Luoghi</h2>
		{#if data.locations.length === 0}
			<p class="muted">Su questa mappa non ci sono ancora luoghi.</p>
		{:else}
			<ul class="places">
				{#each data.locations as l (l.id)}
					<li>
						<a href={hrefOf(l)}>
							<span class="name">{l.name}</span>
							{#if l.kind === 'map_link'}
								<span class="muted small">→ altra mappa</span>
							{:else if l.isPrivate}
								<span class="badge {l.booked ? '' : 'accent'}">{l.booked ? 'privata · occupata' : 'privata · libera'}</span>
							{:else if l.present > 0}
								<span class="badge accent">{l.present} present{l.present === 1 ? 'e' : 'i'}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0 1rem;
		flex-wrap: wrap;
	}
	.weather {
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.moon {
		padding-left: 0.6rem;
		border-left: 1px solid var(--border);
	}
	.description {
		color: var(--text-muted);
		white-space: pre-line;
		max-width: 70ch;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(220px, 1fr);
		gap: 1.5rem;
		align-items: start;
	}
	.layout:has(> section:only-child) {
		grid-template-columns: 1fr;
		max-width: 560px;
	}
	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.places {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.places a {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.25rem;
		border-bottom: 1px solid var(--border);
		text-decoration: none;
		color: var(--text);
	}
	.places a:hover .name {
		color: var(--accent);
	}
	.small {
		font-size: 0.85rem;
	}
</style>
