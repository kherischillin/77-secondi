<script lang="ts">
	import type { PageProps } from './$types';
	import MapCanvas from '#lib/components/MapCanvas.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { SvelteMap } from 'svelte/reactivity';

	let { data, form }: PageProps = $props();

	// Descrizione breve (primo paragrafo) per il suggerimento al passaggio del mouse, e riga "Tipo:" sotto il nome.
	const summary = (text: string | null | undefined) => (text ?? '').split(/\n\s*\n/)[0].trim() || undefined;
	const kindOf = (text: string | null | undefined) => /^Tipo:\s*(.+)$/m.exec(text ?? '')?.[1] ?? null;

	function hrefOf(l: (typeof data.locations)[number]) {
		return l.kind === 'map_link' && l.linkedMapId ? `/gioco/mappa/${l.linkedMapId}` : `/gioco/luogo/${l.id}`;
	}

	const districtAreas = $derived(
		data.districts.flatMap((d) => (d.area ? [{ id: d.id, name: d.name, area: d.area, points: d.shape?.points, label: d.shape?.label, href: `/gioco/mappa/${d.id}`, count: d.present }] : []))
	);

	// Luogo evidenziato: passando sopra al puntino si illumina la riga dell'elenco, e viceversa.
	let hoverId = $state<number | null>(null);
	let query = $state('');
	const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

	// Staff: "Sposta i luoghi". Le nuove posizioni restano in sospeso finché non si salva.
	let editing = $state(false);
	let saving = $state(false);
	const pending = new SvelteMap<number, { x: number; y: number }>();
	/** Luogo senza posizione da mettere sulla mappa con un clic. */
	let placing = $state<number | null>(null);
	const placingName = $derived(data.locations.find((l) => l.id === placing)?.name ?? '');
	const positionsJson = $derived(JSON.stringify([...pending].map(([id, p]) => ({ id, x: p.x, y: p.y }))));

	function stopEditing() {
		editing = false;
		placing = null;
		pending.clear();
	}
	beforeNavigate(({ cancel }) => {
		if (editing && pending.size > 0 && !confirm('Ci sono spostamenti non salvati. Uscire lo stesso?')) cancel();
	});
	// Cambiando mappa si esce dalla modalità.
	$effect(() => {
		void data.map.id;
		stopEditing();
	});

	const markers = $derived(
		data.locations.map((l) => ({
			id: l.id,
			name: l.name,
			x: pending.get(l.id)?.x ?? l.x,
			y: pending.get(l.id)?.y ?? l.y,
			kind: l.kind,
			href: hrefOf(l),
			count: l.present,
			highlight: hoverId === l.id
		}))
	);

	// Elenco: prima i luoghi dove c'è qualcuno, poi gli altri nell'ordine della mappa; filtrabile per nome.
	const shown = $derived(
		data.locations
			.map((l, i) => ({ l, i }))
			.filter(({ l }) => !query.trim() || norm(l.name + ' ' + (kindOf(l.description) ?? '')).includes(norm(query.trim())))
			.sort((a, b) => b.l.present - a.l.present || a.i - b.i)
			.map(({ l }) => l)
	);
	const shownDistricts = $derived(data.districts.filter((d) => !query.trim() || norm(d.name).includes(norm(query.trim()))));
	const searchable = $derived(data.locations.length + data.districts.length > 8);
	const ratio = $derived(data.size ? data.size.width / data.size.height : 16 / 10);
</script>

<svelte:head><title>{data.map.name} · {data.siteName}</title></svelte:head>

<!-- Riga sempre presente (anche vuota): passando da una mappa a un distretto la mappa non si sposta. -->
<p class="crumbs">
	{#if data.parent}<a href="/gioco/mappa/{data.parent.id}">← {data.parent.name}</a>{:else}&nbsp;{/if}
</p>
<div class="head">
	<h1>{data.map.name}</h1>
	{#if data.weather}
		<p class="weather" title={data.weather.manual ? 'Meteo deciso dallo staff' : 'Meteo della zona'}>
			<span aria-hidden="true">{data.weather.icon}</span>
			{data.weather.label}{#if data.weather.temperature !== null}, {data.weather.temperature}°C{/if}
			<span class="moon"><span aria-hidden="true">{data.weather.moon.icon}</span> {data.weather.moon.name}</span>
		</p>
	{/if}
	{#if data.canMove && data.map.imageUrl && data.locations.length && !editing}
		<button type="button" class="secondary edit-open" onclick={() => (editing = true)}>✥ Sposta i luoghi</button>
	{/if}
</div>
{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}
{#if data.canMove && data.map.imageUrl && data.locations.length}
	{#if editing}
		<form
			class="edit-bar"
			method="post"
			action="?/posizioni"
			use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					saving = false;
					if (result.type === 'success') stopEditing();
					await update();
				};
			}}
		>
			<input type="hidden" name="positions" value={positionsJson} />
			<span class="edit-hint">
				{#if placing !== null}
					Clicca sulla mappa dove mettere <strong>{placingName}</strong>.
				{:else}
					Trascina i puntini nel punto che preferisci (oppure selezionali e usa le frecce).
					{#if pending.size}<strong>{pending.size} {pending.size === 1 ? 'luogo spostato' : 'luoghi spostati'}.</strong>{/if}
				{/if}
			</span>
			<span class="edit-actions">
				<button type="submit" disabled={saving || pending.size === 0}>Salva posizioni</button>
				<button type="button" class="secondary" onclick={stopEditing}>Annulla</button>
			</span>
		</form>
	{/if}
{/if}
{#if data.roomWarning}<div class="alert error" role="alert">{data.roomWarning}</div>{/if}

<div class="layout" class:with-map={!!data.map.imageUrl} style:--ratio={ratio}>
	{#if data.map.imageUrl}
		<div class="map-col">
			<MapCanvas
				imageUrl={data.map.imageUrl}
				alt="Mappa: {data.map.name}"
				size={data.size}
				{markers}
				crop={data.crop}
				focus={data.focus}
				districts={districtAreas}
				onhover={(id) => (hoverId = id)}
				{editing}
				onmove={(id, x, y) => pending.set(id, { x, y })}
				onpick={placing !== null
					? (x, y) => {
							pending.set(placing!, { x, y });
							placing = null;
						}
					: undefined}
			/>
		</div>
	{/if}

	<aside class="card panel">
		<div class="panel-inner">
			{#if data.map.description}<p class="description">{data.map.description}</p>{/if}
			{#if searchable}
				<input class="search" type="search" placeholder="Cerca un luogo…" aria-label="Cerca un luogo" bind:value={query} />
			{/if}
			{#if shownDistricts.length}
				<h2>Distretti</h2>
				<ul class="places">
					{#each shownDistricts as d (d.id)}
						<li>
							<a href="/gioco/mappa/{d.id}" title={summary(d.description)}>
								<span class="name">{d.name}</span>
								{#if d.present > 0}<span class="badge accent">{d.present}</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			{#if data.locations.length || !data.districts.length}
				<h2>Luoghi{#if data.locations.length > 0}<span class="muted small"> · {data.locations.length}</span>{/if}</h2>
			{/if}
			{#if data.locations.length === 0 && !data.districts.length}
				<p class="muted">Su questa mappa non ci sono ancora luoghi.</p>
			{:else if shown.length === 0 && data.locations.length > 0}
				<p class="muted small">Nessun luogo con questo nome.</p>
			{:else}
				<ul class="places">
					{#each shown as l (l.id)}
						<li class:lit={hoverId === l.id} onmouseenter={() => (hoverId = l.id)} onmouseleave={() => (hoverId = hoverId === l.id ? null : hoverId)}>
							<a href={hrefOf(l)} title={summary(l.description)} onfocus={() => (hoverId = l.id)} onblur={() => (hoverId = null)}>
								<span class="name-box">
									<span class="name">{l.name}</span>
									{#if kindOf(l.description)}<span class="kind">{kindOf(l.description)}</span>{/if}
								</span>
								{#if l.kind === 'map_link'}
									<span class="muted small">→ mappa</span>
								{:else if l.isPrivate}
									<span class="badge {l.booked ? '' : 'accent'}">{l.booked ? 'occupata' : 'libera'}</span>
								{:else if l.present > 0}
									<span class="badge accent" title="{l.present} present{l.present === 1 ? 'e' : 'i'}">{l.present}</span>
								{/if}
							</a>
							{#if editing && l.x === null && !pending.has(l.id)}
								<button type="button" class="link small place-btn" onclick={() => (placing = placing === l.id ? null : l.id)}>
									{placing === l.id ? 'Annulla' : '📍 Metti sulla mappa'}
								</button>
							{/if}
							{#if l.people.length}
								<div class="people">
									{#each l.people as p (p.id)}<a href="/scheda/{p.id}" title={p.name}><Avatar src={p.avatarUrl} name={p.name} size={22} /></a>{/each}
									{#if l.present > l.people.length}<span class="muted small">+{l.present - l.people.length}</span>{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</aside>
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
		font-size: 0.88rem;
		margin: 0 0 0.85rem;
	}
	/* Mappa e elenco affiancati, alti uguali: l'elenco scorre al suo interno invece di allungare la pagina. */
	.layout {
		--map-max-height: max(26rem, calc(100vh - 13rem));
		display: flex;
		gap: 1.25rem;
		align-items: stretch;
	}
	.map-col {
		flex: 0 1 calc(var(--map-max-height, 80vh) * var(--ratio));
		min-width: 0;
	}
	.panel {
		flex: 1 1 260px;
		min-width: 240px;
		position: relative;
		padding: 0;
	}
	.layout:not(.with-map) .panel {
		flex: 0 1 560px;
	}
	.panel-inner {
		padding: 0.9rem 1rem;
	}
	.with-map .panel-inner {
		position: absolute;
		inset: 0;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	@media (max-width: 860px) {
		.layout {
			flex-direction: column;
		}
		.map-col,
		.panel {
			flex: none;
			min-width: 0;
		}
		.with-map .panel-inner {
			position: static;
			max-height: 55vh;
		}
	}
	.edit-open {
		margin-left: auto;
		align-self: center;
	}
	.edit-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin: 0 0 0.75rem;
		padding: 0.6rem 0.9rem;
		border: 1px dashed var(--focus);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--focus) 8%, transparent);
	}
	.edit-hint {
		font-size: 0.92rem;
	}
	.edit-actions {
		display: flex;
		gap: 0.5rem;
	}
	.place-btn {
		margin: 0 0.3rem 0.4rem;
	}
	.search {
		width: 100%;
		margin-bottom: 0.75rem;
	}
	.panel h2 {
		font-size: 1rem;
		margin: 0 0 0.35rem;
	}
	.panel h2:not(:first-child) {
		margin-top: 1rem;
	}
	.places {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.places li {
		border-bottom: 1px solid var(--border);
		border-radius: calc(var(--radius) / 2);
		transition: background 0.15s ease;
	}
	.places li.lit {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.places > li > a {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.3rem;
		text-decoration: none;
		color: var(--text);
		font-size: 0.92rem;
	}
	.people {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.3rem 0.4rem;
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
	.name-box {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.kind {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
</style>
