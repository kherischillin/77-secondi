<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDate, formatDateTime, fullName } from '#lib/format.ts';

	let { data, form }: PageProps = $props();

	let deleting = $state<number | null>(null);
	const canCreate = $derived(data.characters.length < data.maxCharacters);
	const createErrors = $derived(form?.action === 'crea' ? (form.errors ?? {}) : {});
	const createValues = $derived(
		form?.action === 'crea' && 'values' in form ? form.values : undefined
	);
</script>

<svelte:head><title>Il mio account · {data.siteName}</title></svelte:head>

<h1>Il mio account</h1>

{#if data.welcome === 'admin'}
	<div class="alert success">
		Benvenuto! Sei il primo iscritto, quindi sei l'<strong>Amministratore</strong> del gioco.
		Dal menu <a href="/gestione">Gestione</a> puoi configurare il sito.
	</div>
{:else if data.welcome}
	<div class="alert success">Account creato. Ora dai vita al tuo primo personaggio.</div>
{/if}

<section class="card account">
	<div>
		<strong>{data.account.username}</strong>
		<span class="muted">· {data.account.email}</span>
	</div>
	<div>
		{#each data.account.roles as role (role)}
			<span class="badge accent">{role}</span>
		{/each}
	</div>
</section>

<h2>I miei personaggi <span class="muted count">{data.characters.length}/{data.maxCharacters}</span></h2>

{#if form?.action === 'elimina' && form.success}
	<div class="alert success">Personaggio eliminato.</div>
{/if}
{#if (form?.action === 'gioca' || form?.action === 'elimina') && form.errors?.form}
	<div class="alert error">{form.errors.form}</div>
{/if}

{#if data.characters.length === 0}
	<p class="muted">Non hai ancora nessun personaggio.</p>
{:else}
	<div class="grid">
		{#each data.characters as c (c.id)}
			<article class="card character" class:active={c.id === data.activeCharacterId}>
				<h3>{fullName(c)}</h3>
				{#if c.bio}<p class="bio">{c.bio}</p>{/if}
				<p class="muted small">
					Creato il {formatDate(c.createdAt)}
					{#if c.lastPlayedAt}· ultima giocata {formatDateTime(c.lastPlayedAt)}{/if}
				</p>
				<div class="row">
					<form method="post" action="?/gioca" use:enhance>
						<input type="hidden" name="id" value={c.id} />
						<button type="submit">
							{c.id === data.activeCharacterId ? 'Torna in gioco' : 'Gioca'}
						</button>
					</form>
					<a class="button secondary" href="/scheda/{c.id}">Scheda</a>
					<button class="danger" type="button" onclick={() => (deleting = deleting === c.id ? null : c.id)}>
						Elimina
					</button>
				</div>

				{#if deleting === c.id || (form?.action === 'elimina' && 'deleteId' in form && form.deleteId === c.id)}
					<form method="post" action="?/elimina" class="confirm" use:enhance>
						<input type="hidden" name="id" value={c.id} />
						<label for="confirm-{c.id}">
							Scrivi <strong>{c.name}</strong> per confermare l'eliminazione
						</label>
						<input id="confirm-{c.id}" name="confirm" type="text" autocomplete="off" required />
						{#if form?.action === 'elimina' && form.errors?.confirm}
							<p class="field-error">{form.errors.confirm}</p>
						{/if}
						<button class="danger" type="submit">Elimina definitivamente</button>
					</form>
				{/if}
			</article>
		{/each}
	</div>
{/if}

<h2 class="spaced">Nuovo personaggio</h2>
{#if !canCreate}
	<p class="muted">Hai raggiunto il numero massimo di personaggi.</p>
{:else}
	{#if form?.action === 'crea' && form.success}
		<div class="alert success">Personaggio creato.</div>
	{/if}
	{#if createErrors.form}<div class="alert error">{createErrors.form}</div>{/if}
	<form method="post" action="?/crea" class="stack card" use:enhance>
		<div>
			<label for="name">Nome</label>
			<input id="name" name="name" type="text" required maxlength="30" value={createValues?.name ?? ''} />
			{#if createErrors.name}<p class="field-error">{createErrors.name}</p>{/if}
		</div>
		<div>
			<label for="surname">Cognome <span class="hint">facoltativo</span></label>
			<input id="surname" name="surname" type="text" maxlength="30" value={createValues?.surname ?? ''} />
			{#if createErrors.surname}<p class="field-error">{createErrors.surname}</p>{/if}
		</div>
		<div>
			<label for="bio">Breve presentazione <span class="hint">facoltativa, visibile agli altri</span></label>
			<textarea id="bio" name="bio" maxlength="2000">{createValues?.bio ?? ''}</textarea>
			{#if createErrors.bio}<p class="field-error">{createErrors.bio}</p>{/if}
		</div>
		<button type="submit">Crea personaggio</button>
	</form>
{/if}

<style>
	.account {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 2rem;
	}
	.count {
		font-size: 1rem;
		font-family: var(--font-body);
	}
	.character.active {
		border-color: var(--accent);
	}
	.bio {
		white-space: pre-line;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.small {
		font-size: 0.85rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.confirm {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		display: grid;
		gap: 0.5rem;
	}
	.confirm label {
		font-weight: 400;
	}
	.spaced {
		margin-top: 2.5rem;
	}
</style>
