<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form?.errors ?? {});
</script>

<svelte:head><title>Mappe e luoghi · Gestione</title></svelte:head>

<h1>Mappe e luoghi</h1>
<p class="muted">
	Il mondo è fatto di mappe. Su ogni mappa posizioni dei luoghi: le <strong>chat</strong> dove si
	gioca, oppure dei <strong>collegamenti</strong> verso altre mappe (per esempio "Porta della città").
</p>

{#if data.maps.length === 0}
	<div class="alert">Non c'è ancora nessuna mappa: crea la prima qui sotto. Diventerà la mappa di partenza.</div>
{:else}
	<div class="grid">
		{#each data.maps as m (m.id)}
			<a class="card map" href="/gestione/mondo/mappa/{m.id}">
				{#if m.imageUrl}<img src={m.imageUrl} alt="" />{:else}<div class="noimg">Nessuna immagine</div>{/if}
				<h3>
					{m.name}
					{#if m.isStart}<span class="badge accent">partenza</span>{/if}
				</h3>
				<p class="muted small">{m.locations} {m.locations === 1 ? 'luogo' : 'luoghi'}</p>
			</a>
		{/each}
	</div>
{/if}

<h2 class="spaced">Nuova mappa</h2>
<form method="post" action="?/crea" enctype="multipart/form-data" class="stack card" use:enhance>
	<div>
		<label for="name">Nome</label>
		<input id="name" name="name" type="text" maxlength="60" required value={form?.values?.name ?? ''} />
		{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
	</div>
	<div>
		<label for="description">Descrizione <span class="hint">facoltativa</span></label>
		<textarea id="description" name="description" maxlength="5000">{form?.values?.description ?? ''}</textarea>
	</div>
	<div>
		<label for="image">Immagine della mappa <span class="hint">PNG, JPG, WEBP o GIF, massimo 5 MB</span></label>
		<input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
		{#if errors.image}<p class="field-error">{errors.image}</p>{/if}
	</div>
	<label class="checkbox">
		<input type="checkbox" name="isStart" />
		<span>Mappa di partenza<span class="hint">Dove arrivano i personaggi quando entrano in gioco.</span></span>
	</label>
	<div><button type="submit">Crea mappa</button></div>
</form>

<style>
	.map {
		color: inherit;
		text-decoration: none;
		padding: 0;
		overflow: hidden;
	}
	.map:hover {
		border-color: var(--accent);
	}
	.map img,
	.noimg {
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		display: block;
		background: var(--bg-sunken);
	}
	.noimg {
		display: grid;
		place-items: center;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.map h3,
	.map p {
		padding: 0 1rem;
	}
	.map h3 {
		margin-top: 0.8rem;
	}
	.small {
		font-size: 0.85rem;
	}
	.spaced {
		margin-top: 2.5rem;
	}
</style>
