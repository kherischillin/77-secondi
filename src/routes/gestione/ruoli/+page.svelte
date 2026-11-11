<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Ruoli · Gestione</title></svelte:head>

<h1>Ruoli</h1>
<p class="muted">
	Un ruolo è un insieme di permessi. Ogni account può avere più ruoli: i permessi si sommano.
</p>

<div class="grid">
	{#each data.roles as role (role.id)}
		<a class="card role" href="/gestione/ruoli/{role.id}">
			<h3>
				{role.name}
				{#if role.isSystem}<span class="badge accent">sistema</span>{/if}
				{#if role.isDefault}<span class="badge">nuovi iscritti</span>{/if}
			</h3>
			{#if role.description}<p class="muted">{role.description}</p>{/if}
			<p class="small muted">
				{role.capabilities.length} permess{role.capabilities.length === 1 ? 'o' : 'i'} ·
				{role.members} account
			</p>
		</a>
	{/each}
</div>

<h2 class="spaced">Nuovo ruolo</h2>
{#if form?.error}<div class="alert error">{form.error}</div>{/if}
<form method="post" action="?/crea" class="create" use:enhance>
	<label for="name" class="visually-hidden">Nome del ruolo</label>
	<input id="name" name="name" type="text" placeholder="Es. Narratore" maxlength="40" required value={form?.name ?? ''} />
	<button type="submit">Crea</button>
</form>

<style>
	.role {
		color: inherit;
		text-decoration: none;
		display: block;
	}
	.role:hover {
		border-color: var(--accent);
	}
	.small {
		font-size: 0.85rem;
		margin: 0;
	}
	.spaced {
		margin-top: 2.5rem;
	}
	.create {
		display: flex;
		gap: 0.5rem;
		max-width: 480px;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
