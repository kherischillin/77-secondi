<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime, fullName } from '#lib/format.ts';

	let { data, form }: PageProps = $props();

	// Selezione per eliminare più missive insieme.
	// `picked` può contenere missive non più in elenco (dopo un'eliminazione): conta solo quelle presenti.
	let picked = $state<number[]>([]);
	const selected = $derived(picked.filter((id) => data.threads.some((t) => t.id === id)));
	const allSelected = $derived(data.threads.length > 0 && selected.length === data.threads.length);
	let confirming = $state(false);

	const DAY = 24 * 60 * 60 * 1000;
	/** Giorni che mancano alla cancellazione automatica di una missiva letta (solo in arrivo). */
	function daysLeft(readAt: string | null): number | null {
		if (data.archived || !readAt || data.autoDeleteDays <= 0) return null;
		return Math.max(0, Math.ceil((new Date(readAt).getTime() + data.autoDeleteDays * DAY - Date.now()) / DAY));
	}
	const archiveFull = $derived(data.archive.count >= data.archive.limit);
	const after = () => async ({ update }: { update: () => Promise<void> }) => {
		confirming = false;
		await update();
	};
</script>

<svelte:head><title>Missive · {data.siteName}</title></svelte:head>

<div class="head">
	<h1>Missive di {fullName(data.me)}</h1>
	<a class="button" href="/missive/nuova">Scrivi una missiva</a>
</div>

<nav class="tabs" aria-label="Cartelle">
	<a href="/missive" aria-current={!data.archived ? 'page' : undefined}>In arrivo</a>
	<a href="/missive?archivio" aria-current={data.archived ? 'page' : undefined}>
		Archiviate <span class="muted small">{data.archive.count}/{data.archive.limit}</span>
	</a>
</nav>

<p class="muted small rules">
	{#if data.archived}
		In archivio le missive restano finché non le elimini, fino a un massimo di {data.archive.limit}.
		Se arriva una risposta, la conversazione torna tra quelle in arrivo.
	{:else if data.autoDeleteDays > 0}
		Le missive lette si cancellano da sole {data.autoDeleteDays === 1 ? 'il giorno dopo' : `${data.autoDeleteDays} giorni dopo`} la lettura:
		archivia quelle che vuoi tenere. Quelle non lette non si cancellano mai.
	{/if}
	Eliminare una missiva la toglie solo a te: l'altro personaggio la conserva.
</p>

{#if form?.success}<div class="alert success">{form.success}</div>{/if}
{#if form?.error}<div class="alert error">{form.error}</div>{/if}

{#if data.threads.length === 0}
	<p class="muted">{data.archived ? 'Nessuna missiva archiviata.' : 'Nessuna missiva. Scrivi tu la prima!'}</p>
{:else}
	<form method="post" action="?/elimina" id="bulk" use:enhance={after} class="bulk">
		<label class="checkbox">
			<input
				type="checkbox"
				checked={allSelected}
				onchange={(e) => (picked = (e.currentTarget as HTMLInputElement).checked ? data.threads.map((t) => t.id) : [])}
			/>
			<span>Seleziona tutte</span>
		</label>
		{#each selected as id (id)}<input type="hidden" name="id" value={id} />{/each}
		{#if confirming}
			<span class="small">Eliminare {selected.length === 1 ? '1 missiva' : `${selected.length} missive`}?</span>
			<button type="submit" class="danger small-btn">Sì, elimina</button>
			<button type="button" class="link small" onclick={() => (confirming = false)}>Annulla</button>
		{:else}
			<button type="button" class="secondary small-btn" disabled={!selected.length} onclick={() => (confirming = true)}>
				Elimina selezionate{selected.length ? ` (${selected.length})` : ''}
			</button>
		{/if}
	</form>

	<ul class="threads">
		{#each data.threads as t (t.id)}
			{@const left = daysLeft(t.readAt)}
			<li class:unread={t.unread} class:checked={selected.includes(t.id)}>
				<label class="pick" aria-label="Seleziona «{t.subject}»">
					<input type="checkbox" value={t.id} bind:group={picked} />
				</label>
				<a href="/missive/{t.id}">
					<span class="top">
						<span class="badge {t.onGame ? 'accent' : ''}">{t.onGame ? 'ON' : 'OFF'}</span>
						<strong class="subject">{t.subject}</strong>
						{#if t.unread}<span class="new">nuova</span>{/if}
						<span class="muted small when">{formatDateTime(t.lastMessageAt)}</span>
					</span>
					<span class="muted small">con {t.other ?? '—'}</span>
					<span class="preview">{t.preview}</span>
					{#if left !== null}
						<span class="expires small" class:soon={left <= 1}>
							{left === 0 ? 'Si cancella entro oggi' : left === 1 ? 'Si cancella domani' : `Si cancella tra ${left} giorni`}
						</span>
					{/if}
				</a>
				<form method="post" action={data.archived ? '?/ripristina' : '?/archivia'} use:enhance class="row-action">
					<input type="hidden" name="id" value={t.id} />
					{#if data.archived}
						<button type="submit" class="link small">Riporta in arrivo</button>
					{:else}
						<button type="submit" class="link small" disabled={archiveFull} title={archiveFull ? 'Archivio pieno' : undefined}>Archivia</button>
					{/if}
				</form>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
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
	.threads {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.rules {
		margin: 0 0 1rem;
		max-width: 75ch;
	}
	.bulk {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.6rem;
	}
	.small-btn {
		font-size: 0.85rem;
		padding: 0.3rem 0.8rem;
	}
	.threads li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: stretch;
		gap: 0.5rem;
	}
	.pick {
		display: grid;
		place-items: center;
		padding: 0 0.25rem;
		cursor: pointer;
	}
	.pick input {
		width: 1.05rem;
		height: 1.05rem;
	}
	.row-action {
		display: grid;
		place-items: center;
	}
	.checked a {
		border-color: var(--accent);
	}
	.expires {
		color: var(--text-muted);
		font-style: italic;
	}
	.expires.soon {
		color: var(--danger);
	}
	.threads a {
		display: grid;
		gap: 0.15rem;
		padding: 0.75rem 1rem;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}
	.threads a:hover {
		border-color: var(--accent);
	}
	.unread a {
		border-left: 3px solid var(--accent);
	}
	.top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.subject {
		font-weight: 600;
	}
	.unread .subject {
		color: var(--accent-strong);
	}
	.new {
		font-size: 0.75rem;
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 999px;
		padding: 0 0.5rem;
		font-weight: 700;
	}
	.when {
		margin-left: auto;
	}
	.preview {
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.small {
		font-size: 0.85rem;
	}
	.badge {
		margin: 0;
	}
</style>
