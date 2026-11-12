<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDate, formatDateTime, fullName } from '#lib/format.ts';

	let { data, form }: PageProps = $props();

	let deleting = $state<number | null>(null);
	const canCreate = $derived(data.characters.length < data.maxCharacters);
	const createErrors = $derived(form?.action === 'crea' ? (form.errors ?? {}) : {});
	const notice = (action: string) => (form && 'action' in form && form.action === action ? form : null);
	let showEmail = $state(false);
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
{:else if data.needsCharacter}
	<div class="alert success">Per entrare in gioco crea il tuo primo personaggio qui sotto.</div>
{/if}

<section class="card account">
	<div>
		<strong>{data.account.username}</strong>
		<span class="muted">· {data.account.email ?? 'nessuna email'}</span>
		<button type="button" class="link small" onclick={() => (showEmail = !showEmail)}>{data.account.email ? 'Cambia email' : 'Aggiungi email'}</button>
	</div>
	<div>
		{#each data.account.roles as role (role)}
			<span class="badge accent">{role}</span>
		{/each}
	</div>
</section>

{#if !data.account.email}
	<div class="alert error">
		Il tuo account è stato importato dal vecchio gioco e non ha ancora un'email: aggiungila qui sotto, serve per ritrovare l'account.
	</div>
{/if}
{#if notice('email')}
	{@const n = notice('email')!}
	<div class="alert {'success' in n ? 'success' : 'error'}">{'success' in n ? n.success : n.error}</div>
{/if}
{#if showEmail || !data.account.email}
	<form method="post" action="?/email" class="card stack email-form" use:enhance>
		<div>
			<label for="newEmail">Nuova email</label>
			<input id="newEmail" name="email" type="email" maxlength="254" required autocomplete="email" />
		</div>
		<div>
			<label for="confirmPassword">Password attuale <span class="hint">per conferma</span></label>
			<input id="confirmPassword" name="password" type="password" required autocomplete="current-password" />
		</div>
		<div><button type="submit">Salva email</button></div>
	</form>
{/if}

<h2>I miei personaggi <span class="muted count">{data.characters.length}/{data.maxCharacters}</span></h2>
<p class="muted">Per giocare con un altro personaggio usa <strong>Esci → Cambia personaggio</strong>.</p>

{#if form?.action === 'elimina' && form.success}
	<div class="alert success">Personaggio eliminato.</div>
{/if}
{#if form?.action === 'elimina' && form.errors?.form}
	<div class="alert error">{form.errors.form}</div>
{/if}

{#if data.characters.length === 0}
	<p class="muted">Non hai ancora nessun personaggio.</p>
{:else}
	<div class="grid">
		{#each data.characters as c (c.id)}
			<article class="card character" class:active={c.id === data.activeCharacterId}>
				<h3>{fullName(c)}</h3>
				<p class="muted small">
					Creato il {formatDate(c.createdAt)}
					{#if c.lastPlayedAt}· ultima giocata {formatDateTime(c.lastPlayedAt)}{/if}
				</p>
				<div class="row">
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
		<p class="hint">Dati anagrafici, aspetto, carattere e storia si completano poi dalla scheda.</p>
		<button type="submit">Crea personaggio</button>
	</form>
{/if}

<style>
	.email-form {
		max-width: 480px;
		margin-bottom: 1.5rem;
	}
	.small {
		font-size: 0.85rem;
		margin-left: 0.5rem;
	}
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
