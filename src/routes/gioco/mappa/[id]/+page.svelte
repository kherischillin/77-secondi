<script lang="ts">
	import type { PageProps } from './$types';
	import MapCanvas from '#lib/components/MapCanvas.svelte';
	import Avatar from '#lib/components/Avatar.svelte';

	let { data }: PageProps = $props();

	function hrefOf(l: (typeof data.locations)[number]) {
		return l.kind === 'map_link' && l.linkedMapId ? `/gioco/mappa/${l.linkedMapId}` : `/gioco/luogo/${l.id}`;
	}

	const districtAreas = $derived(
		data.districts.flatMap((d) => (d.area ? [{ id: d.id, name: d.name, area: d.area, href: `/gioco/mappa/${d.id}`, count: d.present }] : []))
	);

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

{#if data.parent}
	<p class="crumbs"><a href="/gioco/mappa/{data.parent.id}">← {data.parent.name}</a></p>
{/if}
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
		<MapCanvas imageUrl={data.map.imageUrl} alt="Mappa: {data.map.name}" {markers} crop={data.crop} districts={districtAreas} />
	{/if}

	<section class="card">
		{#if data.districts.length}
			<h2>Distretti</h2>
			<ul class="places districts">
				{#each data.districts as d (d.id)}
					<li>
						<a href="/gioco/mappa/{d.id}">
							<span class="name">{d.name}</span>
							{#if d.present > 0}<span class="badge accent">{d.present} present{d.present === 1 ? 'e' : 'i'}</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		{#if data.locations.length || !data.districts.length}<h2 class:spaced={data.districts.length > 0}>Luoghi</h2>{/if}
		{#if data.locations.length === 0 && !data.districts.length}
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
						{#if l.people.length}
							<div class="people">
								{#each l.people as p (p.id)}<a href="/scheda/{p.id}" title={p.name}><Avatar src={p.avatarUrl} name={p.name} size={26} /></a>{/each}
								{#if l.present > l.people.length}<span class="muted small">+{l.present - l.people.length}</span>{/if}
							</div>
						{/if}
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
	.places li {
		border-bottom: 1px solid var(--border);
	}
	.places > li > a {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.25rem;
		text-decoration: none;
		color: var(--text);
	}
	.people {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		padding: 0 0.25rem 0.55rem;
	}
	.people a {
		display: inline-flex;
	}
	.places a:hover .name {
		color: var(--accent);
	}
	.small {
		font-size: 0.85rem;
	}
	.crumbs {
		margin: 0 0 0.25rem;
	}
	h2.spaced {
		margin-top: 1.5rem;
	}
</style>
