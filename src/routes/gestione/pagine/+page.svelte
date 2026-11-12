<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Pagine · Gestione</title></svelte:head>

<h1>Pagine informative</h1>
<p class="muted intro">Guida, regolamento, ambientazione e qualsiasi altra pagina da far leggere ai giocatori. Compaiono in fondo a ogni pagina del sito.</p>

<div class="table-wrap card">
	<table>
		<thead><tr><th>Pagina</th><th>Indirizzo</th><th>Chi la legge</th><th>Aggiornata</th></tr></thead>
		<tbody>
			{#each data.pages as p (p.id)}
				<tr>
					<td><a href="/gestione/pagine/{p.id}">{p.title}</a>{#if !p.inFooter}<span class="badge">non in fondo</span>{/if}</td>
					<td><a href="/pagine/{p.slug}" class="muted">/pagine/{p.slug}</a></td>
					<td>{p.isPublic ? 'Tutti' : 'Solo iscritti'}</td>
					<td class="muted">{formatDateTime(p.updatedAt)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<h2 class="spaced">Nuova pagina</h2>
<form method="post" class="row card" use:enhance>
	<label for="title" class="visually-hidden">Titolo</label>
	<input id="title" name="title" type="text" maxlength="80" placeholder="Titolo (es. Regole delle quest)" required value={form?.title ?? ''} />
	<button type="submit">Crea</button>
</form>
{#if form?.error}<p class="field-error">{form.error}</p>{/if}

<style>
	.intro {
		max-width: 80ch;
	}
	.spaced {
		margin-top: 2.5rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		max-width: 560px;
	}
	.row input {
		flex: 1;
		width: auto;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
