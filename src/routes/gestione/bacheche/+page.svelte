<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let confirmDelete = $state<number | null>(null);
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });

	const VIS = { all: 'Tutti', guild: 'Solo una gilda', staff: 'Solo lo staff' } as const;
</script>

<svelte:head><title>Bacheche · Gestione</title></svelte:head>

<h1>Bacheche</h1>
<p class="muted intro">
	<strong>ON GAME</strong>: si scrive come personaggio, dentro la storia. <strong>OFF GAME</strong>: si scrive come giocatore.
	Con "discussioni dello staff" solo i moderatori (o i capi, per le bacheche di gilda) aprono nuove discussioni; gli altri rispondono.
	Ogni gilda ha già la sua bacheca, creata in automatico.
</p>

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

{#snippet fields(b: { name?: string; description?: string; section?: string; visibility?: string; guildId?: number | null; staffOnlyThreads?: boolean; sortOrder?: number })}
	<label class="w-name">Nome <input name="name" value={b.name ?? ''} maxlength="60" required /></label>
	<label class="w-sel">
		Sezione
		<select name="section">
			<option value="on" selected={b.section === 'on'}>ON GAME</option>
			<option value="off" selected={b.section !== 'on'}>OFF GAME</option>
		</select>
	</label>
	<label class="w-sel">
		Chi legge
		<select name="visibility">
			{#each Object.entries(VIS) as [v, l] (v)}<option value={v} selected={(b.visibility ?? 'all') === v}>{l}</option>{/each}
		</select>
	</label>
	<label class="w-sel">
		Gilda
		<select name="guildId">
			<option value="">—</option>
			{#each data.guilds as g (g.id)}<option value={g.id} selected={b.guildId === g.id}>{g.name}</option>{/each}
		</select>
	</label>
	<label class="w-num">Ordine <input name="sortOrder" type="number" value={b.sortOrder ?? 0} /></label>
	<label class="w-full">Descrizione <input name="description" value={b.description ?? ''} maxlength="300" /></label>
	<label class="checkbox w-full"><input type="checkbox" name="staffOnlyThreads" checked={b.staffOnlyThreads ?? false} /><span>Discussioni aperte solo dallo staff</span></label>
{/snippet}

<div class="list">
	{#each data.boards as b (b.id)}
		<div class="card item">
			<form method="post" action="?/salva" class="row-form" use:enhance={keep}>
				<input type="hidden" name="id" value={b.id} />
				{@render fields(b)}
				<div class="buttons">
					<button type="submit">Salva</button>
					<a href="/bacheche/{b.id}" class="button secondary">Apri</a>
					{#if confirmDelete !== b.id}
						<button type="button" class="danger" onclick={() => (confirmDelete = b.id)}>Elimina</button>
					{/if}
					<span class="muted small">{b.threads} discussion{b.threads === 1 ? 'e' : 'i'}</span>
				</div>
			</form>
			{#if confirmDelete === b.id}
				<form method="post" action="?/elimina" class="confirm" use:enhance>
					<input type="hidden" name="id" value={b.id} />
					<span>Eliminare «{b.name}» con tutte le sue discussioni?</span>
					<button type="submit" class="danger">Sì, elimina</button>
					<button type="button" class="secondary" onclick={() => (confirmDelete = null)}>Annulla</button>
				</form>
			{/if}
		</div>
	{/each}
</div>

<details class="add">
	<summary>Aggiungi una bacheca</summary>
	<form method="post" action="?/crea" class="card row-form" use:enhance>
		{@render fields({})}
		<div class="buttons"><button type="submit">Crea</button></div>
	</form>
</details>

<style>
	.intro {
		max-width: 80ch;
	}
	.list {
		display: grid;
		gap: 0.5rem;
	}
	.item {
		padding: 0.75rem 1rem;
	}
	.row-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
		align-items: flex-end;
	}
	.row-form :global(label) {
		font-weight: 400;
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}
	.row-form :global(.w-name) {
		flex: 1 1 200px;
	}
	.row-form :global(.w-sel) {
		flex: 0 1 150px;
	}
	.row-form :global(.w-num) {
		flex: 0 0 80px;
	}
	.row-form :global(.w-full) {
		flex: 1 1 100%;
	}
	.buttons {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.small {
		font-size: 0.85rem;
	}
	.confirm {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}
	.add {
		margin-top: 1rem;
	}
	.add summary {
		cursor: pointer;
		color: var(--accent);
		margin-bottom: 0.5rem;
	}
</style>
