<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';
	import { REPORT_TARGET_LABELS } from '#lib/master.ts';

	let { data, form }: PageProps = $props();
	let closing = $state<number | null>(null);
</script>

<svelte:head><title>Segnalazioni · Gestione</title></svelte:head>

<h1>Segnalazioni</h1>
<p class="muted intro">
	Contenuti segnalati dai giocatori. Per ognuno c'è una copia del testo com'era al momento della segnalazione.
	Le missive restano private: lo staff vede solo il messaggio segnalato.
</p>

<nav class="tabs" aria-label="Stato">
	{#each [['open', 'Da gestire'], ['in_progress', 'In gestione'], ['closed', 'Chiuse']] as [value, label] (value)}
		<a href="?stato={value}" aria-current={data.status === value ? 'page' : undefined}>{label}</a>
	{/each}
</nav>

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

{#if data.reports.length === 0}
	<p class="muted">Nessuna segnalazione {data.status === 'closed' ? 'chiusa' : 'in questo stato'}.</p>
{/if}

<div class="list">
	{#each data.reports as r (r.id)}
		<article class="card report">
			<header>
				<span class="badge">{REPORT_TARGET_LABELS[r.targetType]}</span>
				<span class="muted small">#{r.id} · segnalata da <strong>{r.reporter ?? '—'}</strong> il {formatDateTime(r.createdAt)}</span>
				{#if r.handler}<span class="muted small">· gestita da {r.handler}</span>{/if}
			</header>
			<p class="reason"><strong>Motivo:</strong> {r.reason}</p>
			<div class="snapshot">
				<p class="muted small">
					{r.snapshot.where}
					{#if r.snapshot.author} · autore: {#if r.snapshot.authorCharacterId}<a href="/scheda/{r.snapshot.authorCharacterId}">{r.snapshot.author}</a>{:else}{r.snapshot.author}{/if}{/if}
					{#if r.snapshot.createdAt} · {formatDateTime(r.snapshot.createdAt)}{/if}
					{#if r.snapshot.link} · <a href={r.snapshot.link}>vai al contenuto</a>{/if}
				</p>
				<blockquote>{r.snapshot.text}</blockquote>
			</div>
			{#if r.status === 'closed'}
				<p class="resolution"><strong>Gestione:</strong> {r.resolution ?? '—'} <span class="muted small">({formatDateTime(r.closedAt)})</span></p>
			{:else}
				<div class="actions">
					{#if r.status === 'open'}
						<form method="post" action="?/prendi" use:enhance><input type="hidden" name="id" value={r.id} /><button type="submit" class="secondary">Me ne occupo io</button></form>
					{/if}
					{#if closing !== r.id}
						<button type="button" onclick={() => (closing = r.id)}>Chiudi</button>
					{:else}
						<form method="post" action="?/chiudi" class="close" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<label for="res-{r.id}">Come è stata gestita? <span class="hint">es. avvertimento, messaggio nascosto, nessun problema</span></label>
							<textarea id="res-{r.id}" name="resolution" rows="2" maxlength="2000" required></textarea>
							<div class="row">
								<button type="submit">Chiudi segnalazione</button>
								<button type="button" class="secondary" onclick={() => (closing = null)}>Annulla</button>
							</div>
						</form>
					{/if}
				</div>
			{/if}
		</article>
	{/each}
</div>

<style>
	.intro {
		max-width: 80ch;
	}
	.tabs {
		display: flex;
		gap: 1.25rem;
		margin: 0.5rem 0 1rem;
		border-bottom: 1px solid var(--border);
	}
	.tabs a {
		padding: 0.4rem 0;
		color: var(--text-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}
	.tabs a[aria-current='page'] {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}
	.list {
		display: grid;
		gap: 0.75rem;
	}
	.report header {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.badge {
		margin: 0;
	}
	.reason {
		margin: 0.6rem 0;
	}
	blockquote {
		margin: 0.25rem 0 0;
		padding: 0.6rem 0.8rem;
		background: var(--bg-sunken);
		border-left: 3px solid var(--danger);
		border-radius: 4px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.snapshot p {
		margin: 0;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.close {
		display: grid;
		gap: 0.4rem;
		flex: 1 1 100%;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	.resolution {
		margin: 0.6rem 0 0;
	}
	.small {
		font-size: 0.85rem;
	}
</style>
