<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let confirmDelete = $state(false);
</script>

<svelte:head><title>{data.role.name} · Ruoli</title></svelte:head>

<p><a href="/gestione/ruoli">← Tutti i ruoli</a></p>
<h1>{data.role.name}</h1>
<p class="muted">Assegnato a {data.members} account.</p>

{#if form && 'success' in form && form.success}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form && form.error}<div class="alert error">{form.error}</div>{/if}

{#if data.role.isSystem}
	<div class="alert">
		Questo è il ruolo di sistema: ha sempre tutti i permessi, anche quelli che verranno aggiunti
		in futuro, e non si può modificare né eliminare.
	</div>
{:else if !data.editable}
	<div class="alert">Questo ruolo ha permessi che tu non hai, quindi non puoi modificarlo.</div>
{/if}

<form method="post" action="?/salva" class="stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<fieldset class="card stack" disabled={!data.editable}>
		<div>
			<label for="name">Nome</label>
			<input id="name" name="name" type="text" maxlength="40" required value={data.role.name} />
		</div>
		<div>
			<label for="description">Descrizione</label>
			<input id="description" name="description" type="text" maxlength="200" value={data.role.description} />
		</div>
		<label class="checkbox">
			<input type="checkbox" name="isDefault" checked={data.role.isDefault} />
			<span>Assegna automaticamente ai nuovi iscritti</span>
		</label>
	</fieldset>

	{#each data.groups as group (group.label)}
		<fieldset class="card stack" disabled={!data.editable}>
			<legend>{group.label}</legend>
			{#each group.capabilities as cap (cap.key)}
				<label class="checkbox">
					<input
						type="checkbox"
						name="capabilities"
						value={cap.key}
						checked={data.role.capabilities.includes(cap.key)}
						disabled={!cap.grantable}
					/>
					<span>
						{cap.label}
						<span class="hint"><code>{cap.key}</code>{#if !cap.grantable} · non puoi concederlo{/if}</span>
					</span>
				</label>
			{/each}
		</fieldset>
	{/each}

	{#if data.editable}
		<div><button type="submit">Salva ruolo</button></div>
	{/if}
</form>

{#if data.editable}
	<section class="danger-zone">
		<h2>Elimina ruolo</h2>
		{#if !confirmDelete}
			<button class="danger" type="button" onclick={() => (confirmDelete = true)}>Elimina questo ruolo</button>
		{:else}
			<p>Gli account che hanno questo ruolo lo perderanno. Confermi?</p>
			<form method="post" action="?/elimina" class="row" use:enhance>
				<button class="danger" type="submit">Sì, elimina</button>
				<button class="secondary" type="button" onclick={() => (confirmDelete = false)}>Annulla</button>
			</form>
		{/if}
	</section>
{/if}

<style>
	fieldset {
		margin: 0;
		min-width: 0;
	}
	legend {
		font-family: var(--font-title);
		font-size: 1.15rem;
		padding: 0 0.4rem;
	}
	code {
		font-size: 0.8rem;
	}
	.danger-zone {
		margin-top: 3rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
</style>
