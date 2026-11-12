<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { THEMES, THEME_IDS } from '#lib/themes.ts';

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
	<div>
		<label for="maxGuildsPerCharacter">Gilde massime per personaggio</label>
		<input id="maxGuildsPerCharacter" name="maxGuildsPerCharacter" type="number" min="1" max="10" required value={data.current.maxGuildsPerCharacter} />
		{#if errors.maxGuildsPerCharacter}<p class="field-error">Scegli un numero tra 1 e 10.</p>{/if}
	</div>
	<fieldset class="themes">
		<legend>Tema grafico del sito <span class="hint">ogni giocatore può sceglierne un altro dal proprio account</span></legend>
		{#each THEME_IDS as id (id)}
			<label class="theme">
				<input type="radio" name="theme" value={id} checked={data.current.theme === id} />
				<span class="swatch" aria-hidden="true">{#each THEMES[id].swatch as c (c)}<span style="background: {c}"></span>{/each}</span>
				<span><strong>{THEMES[id].label}</strong> <span class="hint">{THEMES[id].description}</span></span>
			</label>
		{/each}
	</fieldset>
	<div>
		<label for="customCss">CSS personalizzato <span class="hint">facoltativo, per chi conosce il CSS: si aggiunge a tutti i temi</span></label>
		<textarea id="customCss" name="customCss" rows="6" maxlength="50000" spellcheck="false" class="code">{data.current.customCss}</textarea>
		{#if errors.customCss}<p class="field-error">Massimo 50.000 caratteri.</p>{/if}
	</div>
	<label class="checkbox">
		<input type="checkbox" name="registrationsOpen" checked={data.current.registrationsOpen} />
		<span>Iscrizioni aperte<span class="hint">Se disattivato, nessuno può creare nuovi account.</span></span>
	</label>
	<div><button type="submit">Salva impostazioni</button></div>
</form>

<style>
	.themes {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.themes legend {
		padding: 0 0.4rem;
		font-weight: 600;
	}
	.theme {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		font-weight: 400;
		margin: 0;
		cursor: pointer;
	}
	.theme input {
		width: auto;
	}
	.swatch {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
		flex: 0 0 auto;
	}
	.swatch span {
		width: 18px;
		height: 22px;
	}
	.code {
		font-family: ui-monospace, Consolas, monospace;
		font-size: 0.85rem;
	}
</style>
