<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);

	const report = $derived(form && 'report' in form ? form.report : null);
	const step = $derived(form && 'step' in form ? form.step : 'carica');
	const fmt = (n: number) => n.toLocaleString('it-IT', { useGrouping: 'always' });

	const working = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = false;
		};
	};
</script>

<svelte:head><title>Importa da GDRCD · Gestione</title></svelte:head>

<h1>Importa da GDRCD</h1>

{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

{#if step === 'fatto' && report}
	<div class="alert success">Importazione completata.</div>
{:else if step === 'anteprima' && report}
	<div class="alert">
		<strong>Anteprima</strong> di <em>{form && 'fileName' in form ? form.fileName : ''}</em>: è stata fatta una prova completa e poi annullata. Non è ancora cambiato nulla.
	</div>
{/if}

{#if report}
	<div class="grid">
		<section class="card">
			<h2>{step === 'fatto' ? 'Importato' : 'Verrà importato'}</h2>
			{#if Object.keys(report.counts).length === 0}
				<p class="muted">Niente da importare.</p>
			{:else}
				<table>
					<tbody>
						{#each Object.entries(report.counts) as [k, v] (k)}
							<tr><td>{k.charAt(0).toUpperCase() + k.slice(1)}</td><td class="num">{fmt(v)}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
		{#if report.warnings.length}
			<section class="card">
				<h2>Da sapere</h2>
				<ul class="warnings">
					{#each report.warnings as w, i (i)}<li>{w}</li>{/each}
				</ul>
			</section>
		{/if}
	</div>

	{#if report.renamed.length}
		<section class="card spaced">
			<h2>Nomi utente diversi dal nome del personaggio</h2>
			<p class="muted">
				I giocatori possono comunque entrare scrivendo il <strong>nome del personaggio</strong> e la vecchia password. Al primo accesso la password viene
				convertita nel nuovo formato e viene chiesto di aggiungere un'email (GDRCD salvava le email cifrate, quindi non si possono recuperare).
			</p>
			<div class="table-wrap">
				<table>
					<thead><tr><th>Personaggio</th><th>Nome utente</th></tr></thead>
					<tbody>
						{#each report.renamed as r (r.character)}<tr><td>{r.character}</td><td><code>{r.username}</code></td></tr>{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	{#if step === 'anteprima' && form && 'token' in form}
		<div class="actions">
			<form method="post" action="?/importa" use:enhance={working}>
				<input type="hidden" name="token" value={form.token} />
				<button type="submit" disabled={busy}>{busy ? 'Importazione in corso…' : 'Conferma e importa'}</button>
			</form>
			<a class="button secondary" href="/gestione/importa">Annulla</a>
		</div>
	{:else if step === 'fatto'}
		<p class="spaced"><a href="/gestione/registro">Vai al registro attività</a> · <a href="/gestione/mondo">Controlla mappe e luoghi</a></p>
	{/if}
{:else}
	<div class="intro">
		<p>Porta nel nuovo gioco i dati di un vecchio sito GDRCD (versione 5.x): account e personaggi con le loro password, schede, caratteristiche e abilità, PX e denaro, mappe e luoghi, gilde con gradi e stipendi, oggetti, mercato e inventari, bacheche, missive, regolamento e ambientazione.</p>
		<ol>
			<li>Nel pannello del vecchio hosting apri <strong>phpMyAdmin</strong>, scegli il database di GDRCD e clicca <strong>Esporta</strong> (formato SQL, metodo rapido).</li>
			<li>Se il file è troppo grande, esporta in modalità "personalizzata" togliendo la tabella <code>chat</code>: la cronologia della chat non viene comunque importata.</li>
			<li>Carica qui il file (<code>.sql</code> o compresso <code>.sql.gz</code>): vedrai un'<strong>anteprima</strong> prima di confermare.</li>
		</ol>
		<p class="muted">Consiglio: fai una copia di sicurezza del nuovo gioco prima di importare (vedi la guida per lo staff). L'importazione avviene tutta insieme: se qualcosa va storto non viene salvato nulla.</p>
	</div>

	<form method="post" action="?/analizza" enctype="multipart/form-data" class="stack card" use:enhance={working}>
		<div>
			<label for="dump">File del database</label>
			<input id="dump" name="dump" type="file" accept=".sql,.gz,application/sql,application/gzip,text/plain" required />
		</div>
		<fieldset>
			<legend>Caratteristiche del vecchio gioco <span class="hint">come in config.inc.php di GDRCD (car0…car5)</span></legend>
			<div class="stats">
				{#each data.defaultStatNames as name, i (i)}
					<label>car{i} <input name="stat{i}" type="text" maxlength="40" value={name} required /></label>
				{/each}
			</div>
		</fieldset>
		<div class="px">
			<label for="pxPerRank">PX per rango di abilità <span class="hint">px_x_rank nella configurazione di GDRCD (di solito 10): serve a calcolare i PX già spesi</span></label>
			<input id="pxPerRank" name="pxPerRank" type="number" min="1" max="10000" value="10" required />
		</div>
		<div class="checks">
			<label class="checkbox"><input type="checkbox" name="boards" checked /><span>Bacheche e messaggi</span></label>
			<label class="checkbox"><input type="checkbox" name="messages" checked /><span>Missive tra personaggi</span></label>
			<label class="checkbox"><input type="checkbox" name="replacePages" checked /><span>Sostituisci Regolamento e Ambientazione</span></label>
		</div>
		<div><button type="submit" disabled={busy}>{busy ? 'Analisi in corso…' : 'Analizza (anteprima)'}</button></div>
	</form>
{/if}

<style>
	.intro {
		max-width: 80ch;
	}
	.intro li {
		margin-bottom: 0.4rem;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin: 0;
	}
	legend {
		padding: 0 0.4rem;
		font-weight: 600;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
		gap: 0.5rem 0.75rem;
	}
	.stats label {
		display: grid;
		gap: 0.2rem;
		font-weight: 400;
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}
	.px input {
		max-width: 8rem;
	}
	.checks {
		display: flex;
		gap: 0.5rem 1.5rem;
		flex-wrap: wrap;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
		gap: 1rem;
		align-items: start;
	}
	.grid h2,
	.spaced h2 {
		margin-top: 0;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.warnings {
		margin: 0;
		padding-left: 1.2rem;
	}
	.warnings li {
		margin-bottom: 0.4rem;
	}
	.spaced {
		margin-top: 1.5rem;
	}
	.actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 1.5rem;
		align-items: center;
	}
</style>
