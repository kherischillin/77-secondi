<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import MapCanvas from '#lib/components/MapCanvas.svelte';
	import { CLIMATES, CLIMATE_LABELS } from '#lib/weather.ts';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	let confirmDelete = $state(false);

	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	const markers = $derived(
		data.locations.map((l) => ({
			id: l.id,
			name: l.isActive ? l.name : `${l.name} (nascosto)`,
			x: l.x,
			y: l.y,
			kind: l.kind,
			href: `/gestione/mondo/luogo/${l.id}`
		}))
	);
	const unplaced = $derived(data.locations.filter((l) => l.x === null || l.y === null));
</script>

<svelte:head><title>{data.map.name} · Mappe</title></svelte:head>

<p><a href="/gestione/mondo">← Tutte le mappe</a></p>
<h1>
	{data.map.name}
	{#if data.map.isStart}<span class="badge accent">partenza</span>{/if}
</h1>

{#if form && 'success' in form && form.success}<div class="alert success">{form.success}</div>{/if}

<section class="layout">
	<div class="stack">
		{#if data.map.imageUrl}
			<MapCanvas imageUrl={data.map.imageUrl} alt="Mappa {data.map.name}" {markers} />
			<p class="muted small">Clicca su un luogo per modificarlo e posizionarlo.</p>
		{:else}
			<div class="alert">Questa mappa non ha un'immagine: i luoghi verranno mostrati come elenco.</div>
		{/if}

		<h2>Luoghi</h2>
		{#if data.locations.length === 0}
			<p class="muted">Nessun luogo su questa mappa.</p>
		{:else}
			<ul class="locations">
				{#each data.locations as l (l.id)}
					<li>
						<a href="/gestione/mondo/luogo/{l.id}">{l.name}</a>
						{#if l.kind === 'map_link'}<span class="badge">collegamento</span>{/if}
						{#if !l.isActive}<span class="badge danger">nascosto</span>{/if}
						{#if data.map.imageUrl && unplaced.includes(l)}<span class="badge">non posizionato</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<form method="post" action="?/nuovoLuogo" class="inline" use:enhance>
			<label for="locationName" class="visually-hidden">Nome del nuovo luogo</label>
			<input id="locationName" name="name" type="text" maxlength="60" placeholder="Nome del nuovo luogo, es. Locanda del Cervo" required />
			<button type="submit">Aggiungi luogo</button>
		</form>
		{#if errors.locationName}<p class="field-error">{errors.locationName}</p>{/if}
	</div>

	<div class="stack">
		<h2>Dati della mappa</h2>
		<form
			method="post"
			action="?/salva"
			enctype="multipart/form-data"
			class="stack card"
			use:enhance={() => async ({ update }) => update({ reset: false })}
		>
			<div>
				<label for="name">Nome</label>
				<input id="name" name="name" type="text" maxlength="60" required value={data.map.name} />
				{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
			</div>
			<div>
				<label for="description">Descrizione</label>
				<textarea id="description" name="description" maxlength="5000">{data.map.description}</textarea>
			</div>
			<div>
				<label for="image">{data.map.imageUrl ? 'Sostituisci immagine' : 'Immagine'}</label>
				<input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
				{#if errors.image}<p class="field-error">{errors.image}</p>{/if}
			</div>
			{#if data.map.imageUrl}
				<label class="checkbox"><input type="checkbox" name="removeImage" /><span>Rimuovi l'immagine</span></label>
			{/if}
			<div>
				<label for="sortOrder">Ordine <span class="hint">numeri più bassi compaiono prima</span></label>
				<input id="sortOrder" name="sortOrder" type="number" min="-1000" max="1000" value={data.map.sortOrder} />
			</div>
			<label class="checkbox">
				<input type="checkbox" name="isStart" checked={data.map.isStart} disabled={data.map.isStart} />
				<span>Mappa di partenza</span>
			</label>
			<div>
				<label for="climate">Clima <span class="hint">decide il meteo automatico di questa mappa e dei suoi luoghi</span></label>
				<select id="climate" name="climate" value={data.map.climate ?? ''}>
					<option value="">Nessun meteo</option>
					{#each CLIMATES as c (c)}<option value={c}>{CLIMATE_LABELS[c]}</option>{/each}
				</select>
			</div>
			<div><button type="submit">Salva mappa</button></div>
		</form>

		<h2>Meteo</h2>
		<form method="post" action="?/meteo" class="stack card" use:enhance={() => async ({ update }) => update({ reset: false })}>
			{#if data.weather}
				<p class="muted">
					Adesso: <span aria-hidden="true">{data.weather.icon}</span> {data.weather.label}{#if data.weather.temperature !== null}, {data.weather.temperature}°C{/if}
					· {data.weather.moon.name}
					{#if data.weather.manual && data.map.weatherOverrideUntil}(deciso dallo staff fino al {formatDateTime(data.map.weatherOverrideUntil)}){/if}
				</p>
			{/if}
			<div>
				<label for="weatherText">Meteo speciale <span class="hint">es. "Tempesta di sabbia", "Pioggia acida": sostituisce quello automatico</span></label>
				<input id="weatherText" name="text" type="text" maxlength="80" value={data.weather?.manual ? data.map.weatherOverride : ''} />
				{#if errors.text}<p class="field-error">{errors.text}</p>{/if}
			</div>
			<div>
				<label for="weatherHours">Per quante ore</label>
				<select id="weatherHours" name="hours">
					<option value="1">1 ora</option>
					<option value="3" selected>3 ore</option>
					<option value="6">6 ore</option>
					<option value="12">12 ore</option>
					<option value="24">1 giorno</option>
					<option value="72">3 giorni</option>
				</select>
			</div>
			<div class="row">
				<button type="submit">Imposta</button>
				{#if data.weather?.manual}<button type="submit" class="secondary" name="reset" value="1" formnovalidate>Torna al meteo automatico</button>{/if}
			</div>
			{#if form && 'action' in form && form.action === 'meteo' && 'success' in form}<p class="muted">{form.success}</p>{/if}
		</form>

		<section class="danger-zone">
			{#if !confirmDelete && !errors.confirm}
				<button class="danger" type="button" onclick={() => (confirmDelete = true)}>Elimina mappa</button>
			{:else}
				<form method="post" action="?/elimina" class="stack" use:enhance>
					<p>
						Verranno eliminati anche <strong>tutti i luoghi</strong> della mappa e le loro chat.
						Scrivi <strong>{data.map.name}</strong> per confermare.
					</p>
					<input name="confirm" type="text" autocomplete="off" required aria-label="Conferma nome mappa" />
					{#if errors.confirm}<p class="field-error">{errors.confirm}</p>{/if}
					<div class="row">
						<button class="danger" type="submit">Elimina definitivamente</button>
						<button class="secondary" type="button" onclick={() => (confirmDelete = false)}>Annulla</button>
					</div>
				</form>
			{/if}
		</section>
	</div>
</section>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 2rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.small {
		font-size: 0.85rem;
	}
	.locations {
		margin: 0;
		padding-left: 1.2rem;
	}
	.locations li {
		margin-bottom: 0.3rem;
	}
	.inline {
		display: flex;
		gap: 0.5rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	.danger-zone {
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
