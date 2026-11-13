<script lang="ts">
	import IconPicker from '#lib/components/IconPicker.svelte';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { JOIN_MODE_LABELS } from '#lib/social.ts';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form?.errors ?? {});
</script>

<svelte:head><title>Gilde · Gestione</title></svelte:head>

<h1>Gilde</h1>

{#if data.guilds.length}
	<div class="table-wrap card">
		<table>
			<thead><tr><th>Gilda</th><th>Tipo</th><th>Ingresso</th><th>Membri</th></tr></thead>
			<tbody>
				{#each data.guilds as g (g.id)}
					<tr>
						<td>
							<a href="/gestione/gilde/{g.id}">{g.name}</a>
							{#if !g.isActive}<span class="badge danger">non attiva</span>{/if}
						</td>
						<td>{g.category || '—'}</td>
						<td>{JOIN_MODE_LABELS[g.joinMode]}</td>
						<td>{g.members}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted">Nessuna gilda.</p>
{/if}

<h2 class="spaced">Nuova gilda</h2>
<p class="muted">Vengono creati automaticamente i gradi Capo, Ufficiale, Membro e Recluta, e una bacheca riservata ai membri.</p>
<form method="post" enctype="multipart/form-data" class="stack card" use:enhance>
	<div>
		<label for="name">Nome</label>
		<input id="name" name="name" type="text" maxlength="60" required value={form?.values?.name ?? ''} />
		{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
	</div>
	<div>
		<label for="category">Tipo <span class="hint">es. Religiosa, Mercantile, Militare, Criminale</span></label>
		<input id="category" name="category" type="text" maxlength="40" value={form?.values?.category ?? ''} />
	</div>
	<div>
		<label for="joinMode">Come si entra</label>
		<select id="joinMode" name="joinMode">
			{#each Object.entries(JOIN_MODE_LABELS) as [value, label] (value)}
				<option {value} selected={(form?.values?.joinMode ?? 'apply') === value}>{label}</option>
			{/each}
		</select>
	</div>
	<div>
		<label for="description">Descrizione</label>
		<textarea id="description" name="description" rows="4" maxlength="5000">{form?.values?.description ?? ''}</textarea>
	</div>
	<IconPicker selected={form?.values?.icon ?? 'shield'} legend="Icona (in scheda e tra i presenti)" />
	<div>
		<label for="symbol">Simbolo <span class="hint">immagine quadrata, massimo 5 MB</span></label>
		<input id="symbol" name="symbol" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
		{#if errors.symbol}<p class="field-error">{errors.symbol}</p>{/if}
	</div>
	<div><button type="submit">Crea gilda</button></div>
</form>

<style>
	.spaced {
		margin-top: 2.5rem;
	}
</style>
