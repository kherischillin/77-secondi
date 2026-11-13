<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { renderMarkup } from '#lib/markup.ts';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	// Il testo si modifica qui; si riparte dal salvato quando cambia pagina.
	let body = $state('');
	$effect.pre(() => {
		body = data.page.body;
	});
	let preview = $state(false);
	let confirmDelete = $state(false);
</script>

<svelte:head><title>{data.page.title} · Pagine</title></svelte:head>

<p><a href="/gestione/pagine">← Tutte le pagine</a> · <a href="/pagine/{data.page.slug}">Vedi la pagina</a></p>
<h1>{data.page.title}</h1>
{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}

<form method="post" action="?/salva" class="stack card" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<div class="two">
		<div>
			<label for="title">Titolo</label>
			<input id="title" name="title" type="text" maxlength="80" required value={data.page.title} />
			{#if errors.title}<p class="field-error">{errors.title}</p>{/if}
		</div>
		<div>
			<label for="slug">Indirizzo <span class="hint">/pagine/…</span></label>
			<input id="slug" name="slug" type="text" maxlength="60" required value={data.page.slug} />
			{#if errors.slug}<p class="field-error">{errors.slug}</p>{/if}
		</div>
	</div>
	<div>
		<div class="tabs">
			<button type="button" class:active={!preview} onclick={() => (preview = false)}>Testo</button>
			<button type="button" class:active={preview} onclick={() => (preview = true)}>Anteprima</button>
		</div>
		<textarea id="body" name="body" rows="22" maxlength="100000" bind:value={body} hidden={preview} aria-label="Testo della pagina"></textarea>
		{#if preview}<div class="preview prose">{@html renderMarkup(body)}</div>{/if}
		{#if errors.body}<p class="field-error">{errors.body}</p>{/if}
		<p class="hint help">
			<code># Titolo</code> · <code>## Sottotitolo</code> · <code>**grassetto**</code> · <code>*corsivo*</code> · <code>- elenco</code> · <code>1. elenco numerato</code> ·
			<code>&gt; citazione</code> · <code>[testo](/pagine/regolamento)</code> · <code>---</code> separatore. L'HTML non viene eseguito.
		</p>
	</div>
	<div class="checks">
		<label class="checkbox"><input type="checkbox" name="inFooter" checked={data.page.inFooter} /><span>Link in fondo a ogni pagina</span></label>
		<label class="checkbox"><input type="checkbox" name="isPublic" checked={data.page.isPublic} /><span>Leggibile anche senza account</span></label>
		<label class="order">Ordine <input name="sortOrder" type="number" min="-1000" max="1000" value={data.page.sortOrder} /></label>
	</div>
	<div><button type="submit">Salva</button></div>
</form>

<section class="danger-zone">
	{#if !confirmDelete}
		<button type="button" class="danger" onclick={() => (confirmDelete = true)}>Elimina pagina</button>
	{:else}
		<form method="post" action="?/elimina" class="row" use:enhance>
			<button type="submit" class="danger">Sì, elimina</button>
			<button type="button" class="secondary" onclick={() => (confirmDelete = false)}>Annulla</button>
		</form>
	{/if}
</section>

<style>
	.two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		gap: 0.75rem;
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}
	.tabs button {
		box-shadow: none;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border);
		padding: 0.3rem 0.9rem;
	}
	.tabs button.active {
		color: var(--accent);
		border-color: var(--accent);
	}
	textarea {
		font-family: ui-monospace, Consolas, monospace;
		font-size: 0.9rem;
		line-height: 1.5;
	}
	.preview {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem 1.25rem;
		min-height: 20rem;
		max-width: 72ch;
	}
	.preview :global(ul),
	.preview :global(ol) {
		padding-left: 1.4rem;
	}
	.help {
		display: block;
		margin-top: 0.5rem;
		line-height: 1.9;
	}
	.checks {
		display: flex;
		gap: 0.5rem 1.5rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.order {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin: 0;
		font-weight: 400;
	}
	.order input {
		width: 6rem;
	}
	.danger-zone {
		margin-top: 2rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
</style>
