<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import ItemForm from '#lib/components/ItemForm.svelte';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	const it = $derived(data.item);
	let confirmDelete = $state(false);
</script>

<svelte:head><title>{it.name} · Oggetti</title></svelte:head>

<p><a href="/gestione/oggetti">← Tutti gli oggetti</a></p>
<h1>
	{it.name}
	{#if it.archived}<span class="badge">archiviato</span>{/if}
</h1>
{#if data.isNew}<div class="alert success">Oggetto creato.</div>{/if}
{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<div class="layout">
	<form method="post" action="?/salva" enctype="multipart/form-data" class="stack card" use:enhance={() => async ({ update }) => update({ reset: false })}>
		{#if it.imageUrl}<img class="preview" src={it.imageUrl} alt="" />{/if}
		<ItemForm values={it} {errors} stats={data.names.stats} skills={data.names.skills} categories={data.categories} shops={data.shops} />
		{#if it.imageUrl}<label class="checkbox"><input type="checkbox" name="removeImage" /><span>Rimuovi l'immagine</span></label>{/if}
		<div><button type="submit">Salva</button></div>
	</form>

	<aside class="stack">
		<section class="card stack">
			<h2>Consegna a un personaggio</h2>
			<p class="muted small">Per premi di quest o ritrovamenti. Non puoi consegnare oggetti ai tuoi personaggi.</p>
			<form method="post" action="?/consegna" class="stack" use:enhance>
				<input name="to" type="text" placeholder="Nome del personaggio" required aria-label="Nome del personaggio" disabled={it.archived} />
				<div class="row">
					<input name="quantity" type="number" min="1" max="100" value="1" aria-label="Quantità" class="num" disabled={it.archived} />
					<button type="submit" disabled={it.archived}>Consegna</button>
				</div>
			</form>
		</section>

		<section class="card stack">
			<h2>In circolazione</h2>
			<p class="muted small">{data.owned === 0 ? 'Nessun personaggio lo possiede.' : `${data.owned} ${data.owned === 1 ? 'pezzo posseduto' : 'pezzi posseduti'} dai personaggi.`}</p>
			<form method="post" action="?/archivia" use:enhance>
				<button type="submit" class="secondary">{it.archived ? 'Ripristina' : 'Archivia'}</button>
			</form>
			{#if data.owned === 0}
				{#if !confirmDelete}
					<button type="button" class="danger" onclick={() => (confirmDelete = true)}>Elimina</button>
				{:else}
					<form method="post" action="?/elimina" class="row" use:enhance>
						<button type="submit" class="danger">Elimina definitivamente</button>
						<button type="button" class="secondary" onclick={() => (confirmDelete = false)}>Annulla</button>
					</form>
				{/if}
			{/if}
		</section>
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr);
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	aside h2 {
		margin: 0;
	}
	aside p {
		margin: 0;
	}
	.preview {
		width: 120px;
		height: 120px;
		object-fit: cover;
		border-radius: var(--radius);
	}
	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.num {
		width: 5rem;
	}
	.small {
		font-size: 0.88rem;
	}
</style>
