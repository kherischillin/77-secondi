<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDate, formatDateTime, fullName } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{data.target.username} · Gestione</title></svelte:head>

<p><a href="/gestione/utenti">← Tutti gli account</a></p>
<h1>{data.target.username}</h1>

{#if form && 'success' in form && form.success}
	<div class="alert success">{form.success}</div>
{/if}
{#if form && 'error' in form && form.error}
	<div class="alert error">{form.error}</div>
{/if}

<section class="card stack">
	<dl>
		<dt>Email</dt><dd>{data.target.email}</dd>
		<dt>Iscritto il</dt><dd>{formatDate(data.target.createdAt)}</dd>
		<dt>Ultimo accesso</dt><dd>{formatDateTime(data.target.lastLoginAt)}</dd>
		<dt>Stato</dt>
		<dd>
			{#if data.target.bannedUntil}
				<span class="badge danger">Sospeso fino al {formatDateTime(data.target.bannedUntil)}</span>
				{#if data.target.banReason}<br /><span class="muted">{data.target.banReason}</span>{/if}
			{:else}
				Attivo
			{/if}
		</dd>
	</dl>
</section>

<h2>Personaggi</h2>
{#if data.characters.length}
	<ul>
		{#each data.characters as c (c.id)}
			<li>{fullName(c)} <span class="muted">· creato il {formatDate(c.createdAt)}</span></li>
		{/each}
	</ul>
{:else}
	<p class="muted">Nessun personaggio.</p>
{/if}

<h2>Ruoli</h2>
{#if data.isSelf}
	<p class="muted">Non puoi modificare i tuoi ruoli né sospendere il tuo account.</p>
{:else if !data.canManage}
	<p class="muted">Non puoi modificare questo account: ha poteri pari o superiori ai tuoi.</p>
{/if}

<form method="post" action="?/ruoli" class="card stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
	{#each data.roles as role (role.id)}
		<label class="checkbox">
			<input
				type="checkbox"
				name="roles"
				value={role.id}
				checked={data.target.roleIds.includes(role.id)}
				disabled={!data.canManage || !role.assignable}
			/>
			<span>
				<strong>{role.name}</strong>
				{#if role.description}<span class="hint">{role.description}</span>{/if}
				{#if data.canManage && !role.assignable}<span class="hint">Non puoi assegnare questo ruolo.</span>{/if}
			</span>
		</label>
	{/each}
	{#if data.canManage}
		<div><button type="submit">Salva ruoli</button></div>
	{/if}
</form>

{#if data.canManage}
	<h2>Sospensione</h2>
	{#if data.target.bannedUntil}
		<form method="post" action="?/riattiva" use:enhance>
			<button type="submit" class="secondary">Revoca la sospensione</button>
		</form>
	{:else}
		<form method="post" action="?/sospendi" class="card stack" use:enhance>
			<div>
				<label for="days">Durata (giorni)</label>
				<input id="days" name="days" type="number" min="1" max="3650" value="7" required />
			</div>
			<div>
				<label for="reason">Motivo</label>
				<input id="reason" name="reason" type="text" maxlength="300" required />
				<span class="hint">Viene mostrato all'utente quando prova ad accedere.</span>
			</div>
			<div><button type="submit" class="danger">Sospendi account</button></div>
		</form>
	{/if}
{/if}

<style>
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.4rem 1.5rem;
		margin: 0;
	}
	dt {
		color: var(--text-muted);
	}
	dd {
		margin: 0;
	}
	h2 {
		margin-top: 2rem;
	}
</style>
