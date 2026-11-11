<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import MapCanvas from '#lib/components/MapCanvas.svelte';

	let { data, form }: PageProps = $props();

	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});

	// Valori modificabili dal clic sulla mappa e dal menu "tipo".
	let x = $state<number | null>(null);
	let y = $state<number | null>(null);
	let kind = $state<'chat' | 'map_link'>('chat');
	let confirmDelete = $state(false);

	$effect.pre(() => {
		x = data.location.x;
		y = data.location.y;
		kind = data.location.kind;
	});

	const markers = $derived([
		...data.siblings.map((s) => ({ ...s, name: s.name })),
		{ id: data.location.id, name: data.location.name, x, y, kind, highlight: true }
	]);
</script>

<svelte:head><title>{data.location.name} · Luoghi</title></svelte:head>

<p><a href="/gestione/mondo/mappa/{data.map.id}">← {data.map.name}</a></p>
<h1>{data.location.name}</h1>

{#if data.isNew && !form}
	<div class="alert success">Luogo creato. Completa la descrizione e posizionalo sulla mappa.</div>
{/if}
{#if form && 'success' in form && form.success}<div class="alert success">{form.success}</div>{/if}

<form
	method="post"
	action="?/salva"
	enctype="multipart/form-data"
	class="layout"
	use:enhance={() => async ({ update }) => update({ reset: false })}
>
	<div class="stack">
		{#if data.map.imageUrl}
			<h2>Posizione sulla mappa</h2>
			<p class="muted small">
				Clicca sulla mappa nel punto in cui deve comparire il luogo.
				{#if x !== null}<button type="button" class="link" onclick={() => ((x = null), (y = null))}>Togli dalla mappa</button>{/if}
			</p>
			<MapCanvas
				imageUrl={data.map.imageUrl}
				alt="Mappa {data.map.name}"
				{markers}
				onpick={(px, py) => {
					x = px;
					y = py;
				}}
			/>
			<input type="hidden" name="x" value={x ?? ''} />
			<input type="hidden" name="y" value={y ?? ''} />
		{:else}
			<div class="alert">La mappa non ha un'immagine: il luogo comparirà nell'elenco dei luoghi.</div>
		{/if}
	</div>

	<div class="stack card">
		<div>
			<label for="name">Nome</label>
			<input id="name" name="name" type="text" maxlength="60" required value={data.location.name} />
			{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
		</div>

		<div>
			<label for="kind">Tipo</label>
			<select id="kind" name="kind" bind:value={kind}>
				<option value="chat">Luogo di gioco (chat)</option>
				<option value="map_link">Collegamento a un'altra mappa</option>
			</select>
		</div>

		{#if kind === 'map_link'}
			<div>
				<label for="linkedMapId">Porta alla mappa</label>
				<select id="linkedMapId" name="linkedMapId">
					<option value="">Scegli…</option>
					{#each data.maps as m (m.id)}
						<option value={m.id} selected={data.location.linkedMapId === m.id}>{m.name}</option>
					{/each}
				</select>
				{#if data.maps.length === 0}<p class="hint">Crea prima un'altra mappa.</p>{/if}
				{#if errors.linkedMapId}<p class="field-error">{errors.linkedMapId}</p>{/if}
			</div>
		{/if}

		<div>
			<label for="description">Descrizione</label>
			<textarea id="description" name="description" maxlength="5000" rows="8">{data.location.description}</textarea>
			<span class="hint">
				Compare accanto alla chat: aiuta i giocatori a orientarsi (com'è il luogo, cosa si vede, chi lo frequenta).
			</span>
			{#if errors.description}<p class="field-error">{errors.description}</p>{/if}
		</div>

		<div>
			<label for="image">{data.location.imageUrl ? 'Sostituisci immagine' : 'Immagine del luogo'} <span class="hint">facoltativa</span></label>
			{#if data.location.imageUrl}<img class="preview" src={data.location.imageUrl} alt="" />{/if}
			<input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
			{#if errors.image}<p class="field-error">{errors.image}</p>{/if}
		</div>
		{#if data.location.imageUrl}
			<label class="checkbox"><input type="checkbox" name="removeImage" /><span>Rimuovi l'immagine</span></label>
		{/if}

		<div>
			<label for="sortOrder">Ordine nell'elenco</label>
			<input id="sortOrder" name="sortOrder" type="number" min="-1000" max="1000" value={data.location.sortOrder} />
		</div>
		<label class="checkbox">
			<input type="checkbox" name="isActive" checked={data.location.isActive} />
			<span>Visibile ai giocatori<span class="hint">Togli la spunta per preparare un luogo senza mostrarlo.</span></span>
		</label>

		<div><button type="submit">Salva luogo</button></div>
	</div>
</form>

<section class="danger-zone">
	{#if !confirmDelete}
		<button class="danger" type="button" onclick={() => (confirmDelete = true)}>Elimina luogo</button>
	{:else}
		<p>Verranno eliminati anche <strong>tutti i messaggi</strong> della sua chat. Confermi?</p>
		<form method="post" action="?/elimina" class="row" use:enhance>
			<button class="danger" type="submit">Sì, elimina</button>
			<button class="secondary" type="button" onclick={() => (confirmDelete = false)}>Annulla</button>
		</form>
	{/if}
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
	.preview {
		display: block;
		max-width: 100%;
		max-height: 160px;
		border-radius: var(--radius);
		margin-bottom: 0.5rem;
	}
	.danger-zone {
		margin-top: 3rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
</style>
