<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
</script>

<svelte:head><title>Impostazioni · Gestione</title></svelte:head>

<h1>Impostazioni del sito</h1>

{#if form && 'success' in form && form.success}<div class="alert success">Impostazioni salvate.</div>{/if}

<form method="post" class="stack card" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<div>
		<label for="siteName">Nome del gioco</label>
		<input id="siteName" name="siteName" type="text" maxlength="80" required value={data.current.siteName} />
		{#if errors.siteName}<p class="field-error">{errors.siteName}</p>{/if}
	</div>
	<div>
		<label for="siteTagline">Sottotitolo</label>
		<input id="siteTagline" name="siteTagline" type="text" maxlength="200" value={data.current.siteTagline} />
		<span class="hint">Compare in homepage e in fondo a ogni pagina.</span>
		{#if errors.siteTagline}<p class="field-error">{errors.siteTagline}</p>{/if}
	</div>
	<div>
		<label for="maxCharactersPerUser">Personaggi massimi per account</label>
		<input
			id="maxCharactersPerUser"
			name="maxCharactersPerUser"
			type="number"
			min="1"
			max="20"
			required
			value={data.current.maxCharactersPerUser}
		/>
		{#if errors.maxCharactersPerUser}<p class="field-error">Scegli un numero tra 1 e 20.</p>{/if}
	</div>
	<label class="checkbox">
		<input type="checkbox" name="registrationsOpen" checked={data.current.registrationsOpen} />
		<span>Iscrizioni aperte<span class="hint">Se disattivato, nessuno può creare nuovi account.</span></span>
	</label>
	<div><button type="submit">Salva impostazioni</button></div>
</form>
