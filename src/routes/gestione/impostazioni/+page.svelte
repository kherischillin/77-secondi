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
	<fieldset class="portrait-settings">
		<legend>Presta-volto dei personaggi</legend>
		<p class="hint">
			I giocatori collegano l'immagine con un link. Sono accettati solo link <strong>https://</strong> dai siti elencati qui
			sotto (uno per riga; <code>*.esempio.it</code> ammette tutti i sottodomini). Se togli un sito, le immagini già
			collegate da lì smettono di essere mostrate.
		</p>
		<div>
			<label for="portraitHosts">Siti ammessi</label>
			<textarea id="portraitHosts" name="portraitHosts" rows="6" spellcheck="false">{data.current.portraitHosts.join('\n')}</textarea>
			{#if errors.portraitHosts}<p class="field-error">{errors.portraitHosts}</p>{/if}
		</div>
		<div class="sizes">
			<div>
				<label for="portraitMaxWidth">Larghezza (px)</label>
				<input id="portraitMaxWidth" name="portraitMaxWidth" type="number" min="80" max="1000" required value={data.current.portraitMaxWidth} />
				{#if errors.portraitMaxWidth}<p class="field-error">Scegli un numero tra 80 e 1000.</p>{/if}
			</div>
			<div>
				<label for="portraitMaxHeight">Altezza (px)</label>
				<input id="portraitMaxHeight" name="portraitMaxHeight" type="number" min="80" max="1500" required value={data.current.portraitMaxHeight} />
				{#if errors.portraitMaxHeight}<p class="field-error">Scegli un numero tra 80 e 1500.</p>{/if}
			</div>
		</div>
		<p class="hint">Nella scheda il presta-volto occupa sempre questo riquadro (di base 350 × 500): l'immagine viene adattata senza deformarla e, se ha proporzioni diverse, i bordi in eccesso vengono tagliati.</p>
	</fieldset>
	<fieldset class="portrait-settings">
		<legend>Missive</legend>
		<div class="sizes">
			<div>
				<label for="missiveArchiveLimit">Missive archiviabili per personaggio</label>
				<input id="missiveArchiveLimit" name="missiveArchiveLimit" type="number" min="0" max="1000" required value={data.current.missiveArchiveLimit} />
				{#if errors.missiveArchiveLimit}<p class="field-error">Scegli un numero tra 0 e 1000.</p>{/if}
			</div>
			<div>
				<label for="missiveAutoDeleteDays">Cancella le lette dopo (giorni)</label>
				<input id="missiveAutoDeleteDays" name="missiveAutoDeleteDays" type="number" min="0" max="365" required value={data.current.missiveAutoDeleteDays} />
				{#if errors.missiveAutoDeleteDays}<p class="field-error">Scegli un numero tra 0 e 365.</p>{/if}
			</div>
		</div>
		<p class="hint">
			Le missive lette e <strong>non archiviate</strong> si cancellano da sole dopo questi giorni dall'ultima lettura (0 = mai).
			Quelle non lette e quelle in archivio non si cancellano mai da sole. Il controllo avviene ogni ora.
		</p>
	</fieldset>
	<fieldset class="portrait-settings">
		<legend>Chat</legend>
		<div class="sizes">
			<div>
				<label for="chatVisibleHours">Ore di chat visibili a chi entra</label>
				<input id="chatVisibleHours" name="chatVisibleHours" type="number" min="1" max="72" required value={data.current.chatVisibleHours} />
				{#if errors.chatVisibleHours}<p class="field-error">Scegli un numero tra 1 e 72.</p>{/if}
			</div>
			<div>
				<label for="chatRetentionDays">Cancella i messaggi dopo (giorni)</label>
				<input id="chatRetentionDays" name="chatRetentionDays" type="number" min="0" max="3650" required value={data.current.chatRetentionDays} />
				{#if errors.chatRetentionDays}<p class="field-error">Scegli un numero tra 0 e 3650.</p>{/if}
			</div>
		</div>
		<p class="hint">
			Chi entra in un luogo vede solo i messaggi di queste ultime ore; moderatori e amministratori possono caricare anche quelli precedenti.
			I messaggi più vecchi dei giorni scelti si cancellano dal database (0 = mai), tranne quelli delle quest ancora in corso.
			Le giocate registrate sono copie a parte e non si perdono. Il controllo avviene ogni ora.
		</p>
	</fieldset>
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
	.portrait-settings {
		display: grid;
		gap: 0.75rem;
	}
	.portrait-settings textarea {
		font-family: ui-monospace, Consolas, monospace;
	}
	.sizes {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
</style>
