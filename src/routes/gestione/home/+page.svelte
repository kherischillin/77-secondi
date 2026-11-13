<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
	let editing = $state<number | null>(null);
	let confirmDelete = $state<number | null>(null);
	const msg = (action: string) => (form && 'action' in form && form.action === action ? form : null);
</script>

<svelte:head><title>Pagina iniziale · Gestione</title></svelte:head>

<h1>Pagina iniziale</h1>
<p class="muted intro">È la prima cosa che vede chi apre il sito: titolo, riquadro di benvenuto, numero dei presenti e news. <a href="/" target="_blank">Apri la pagina iniziale ↗</a></p>

<div class="layout">
	<form method="post" action="?/benvenuto" enctype="multipart/form-data" class="stack card" use:enhance={keep}>
		<h2>Benvenuto e sfondo</h2>
		{#if msg('benvenuto') && 'success' in form!}<div class="alert success">{form.success}</div>{/if}
		{#if msg('benvenuto') && 'error' in form!}<div class="alert error">{form.error}</div>{/if}
		<div>
			<label for="chapter">Riga sopra il titolo <span class="hint">es. il capitolo della trama · max 100</span></label>
			<input id="chapter" name="chapter" type="text" maxlength="100" value={data.home.chapter} />
		</div>
		<div>
			<label for="presentLine">Frase sotto i presenti <span class="hint">max 80</span></label>
			<input id="presentLine" name="presentLine" type="text" maxlength="80" value={data.home.presentLine} />
		</div>
		<div>
			<label for="welcomeTitle">Titolo del benvenuto <span class="hint">max 60</span></label>
			<input id="welcomeTitle" name="welcomeTitle" type="text" maxlength="60" value={data.home.welcomeTitle} />
		</div>
		<div>
			<label for="welcomeText">Testo del benvenuto <span class="hint">max 1500 · riga vuota = nuovo paragrafo</span></label>
			<textarea id="welcomeText" name="welcomeText" rows="7" maxlength="1500">{data.home.welcomeText}</textarea>
		</div>
		<div class="bg-row">
			{#if data.home.backgroundUrl}
				<img src={data.home.backgroundUrl} alt="Sfondo attuale" />
			{:else}
				<p class="muted small">Ora c'è lo sfondo predefinito: lo skyline della città disegnato con i colori del tema.</p>
			{/if}
			<div>
				<label for="background">{data.home.backgroundUrl ? 'Sostituisci lo sfondo' : 'Immagine di sfondo'} <span class="hint">orizzontale, almeno 1600 px di larghezza · max 5 MB</span></label>
				<input id="background" name="background" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
				{#if data.home.backgroundUrl}<label class="checkbox"><input type="checkbox" name="removeBackground" /><span>Torna allo sfondo predefinito</span></label>{/if}
			</div>
		</div>
		<div><button type="submit">Salva</button></div>
	</form>

	<section class="stack">
		<form method="post" action="?/nuovaNews" class="stack card" use:enhance>
			<h2>Nuova news</h2>
			{#if msg('nuovaNews') && 'success' in form!}<div class="alert success">{form.success}</div>{/if}
			{#if msg('nuovaNews') && 'error' in form!}<div class="alert error">{form.error}</div>{/if}
			<div>
				<label for="n-title">Titolo <span class="hint">max 80</span></label>
				<input id="n-title" name="title" type="text" maxlength="80" required />
			</div>
			<div>
				<label for="n-summary">Riga breve <span class="hint">compare sotto il titolo · max 160</span></label>
				<input id="n-summary" name="summary" type="text" maxlength="160" />
			</div>
			<div>
				<label for="n-body">Testo completo <span class="hint">facoltativo: si apre cliccando la news · stessa formattazione delle Pagine</span></label>
				<textarea id="n-body" name="body" rows="4" maxlength="10000"></textarea>
			</div>
			<div class="checks">
				<label class="checkbox"><input type="checkbox" name="isPublished" checked /><span>Pubblicata</span></label>
				<label class="checkbox"><input type="checkbox" name="isPinned" /><span>In evidenza (resta in cima)</span></label>
			</div>
			<div><button type="submit">Pubblica</button></div>
		</form>

		<div class="card">
			<h2>News <span class="muted small">· {data.news.length}</span></h2>
			{#if msg('eliminaNews') && 'success' in form!}<div class="alert success">{form.success}</div>{/if}
			{#if data.news.length === 0}<p class="muted">Nessuna news.</p>{/if}
			<ul class="news">
				{#each data.news as n (n.id)}
					<li>
						{#if editing === n.id}
							<form
								method="post"
								action="?/salvaNews"
								class="stack"
								use:enhance={() => async ({ result, update }) => {
									await update({ reset: false });
									if (result.type === 'success') editing = null;
								}}
							>
								<input type="hidden" name="id" value={n.id} />
								{#if msg('salvaNews') && 'error' in form!}<div class="alert error">{form.error}</div>{/if}
								<input name="title" type="text" maxlength="80" required value={n.title} aria-label="Titolo" />
								<input name="summary" type="text" maxlength="160" value={n.summary} aria-label="Riga breve" placeholder="Riga breve" />
								<textarea name="body" rows="4" maxlength="10000" aria-label="Testo completo" placeholder="Testo completo (facoltativo)">{n.body}</textarea>
								<div class="checks">
									<label class="checkbox"><input type="checkbox" name="isPublished" checked={n.isPublished} /><span>Pubblicata</span></label>
									<label class="checkbox"><input type="checkbox" name="isPinned" checked={n.isPinned} /><span>In evidenza</span></label>
								</div>
								<div class="row">
									<button type="submit">Salva</button>
									<button type="button" class="secondary" onclick={() => (editing = null)}>Annulla</button>
								</div>
							</form>
						{:else}
							<div class="news-head">
								<div>
									<strong>{n.title}</strong>
									{#if n.isPinned}<span class="badge accent">in evidenza</span>{/if}
									{#if !n.isPublished}<span class="badge">bozza</span>{/if}
									{#if n.summary}<p class="muted small">{n.summary}</p>{/if}
									<p class="muted tiny">{formatDateTime(n.createdAt)}</p>
								</div>
								<div class="row">
									<button type="button" class="link" onclick={() => ((editing = n.id), (confirmDelete = null))}>Modifica</button>
									<form method="post" action="?/eliminaNews" use:enhance>
										<input type="hidden" name="id" value={n.id} />
										{#if confirmDelete === n.id}
											<button type="submit" class="link danger-link">Sì, cancella</button>
											<button type="button" class="link" onclick={() => (confirmDelete = null)}>No</button>
										{:else}
											<button type="button" class="link danger-link" onclick={() => (confirmDelete = n.id)}>Cancella</button>
										{/if}
									</form>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	</section>
</div>

<style>
	.intro {
		max-width: 70ch;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 1000px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.bg-row {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}
	.bg-row img {
		width: 180px;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border-radius: var(--radius);
		border: 1px solid var(--border);
	}
	.checks,
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
	}
	.row form {
		display: flex;
		gap: 0.5rem;
		margin: 0;
	}
	.news {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.news li {
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--border);
	}
	.news-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}
	.news p {
		margin: 0.15rem 0 0;
	}
	.small {
		font-size: 0.88rem;
	}
	.tiny {
		font-size: 0.78rem;
	}
	.danger-link {
		color: var(--danger);
	}
</style>
