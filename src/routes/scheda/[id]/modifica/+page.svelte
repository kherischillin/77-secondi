<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { fullName } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form?.errors ?? {});
	const c = $derived(data.character);
</script>

<svelte:head><title>Modifica {fullName(c)}</title></svelte:head>

<p><a href="/scheda/{c.id}">← Torna alla scheda</a></p>
<h1>Modifica la scheda di {fullName(c)}</h1>
<p class="muted">
	La scheda è uno strumento fuori gioco: serve agli altri giocatori per conoscere il tuo personaggio.
	In gioco gli altri personaggi possono cogliere solo l'aspetto.
</p>

<form method="post" enctype="multipart/form-data" class="stack card edit" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<div>
		<label for="bio">Presentazione breve</label>
		<textarea id="bio" name="bio" maxlength="2000" rows="3">{c.bio ?? ''}</textarea>
		<span class="hint">Una frase o due che compaiono in cima alla scheda.</span>
		{#if errors.bio}<p class="field-error">{errors.bio}</p>{/if}
	</div>
	<div>
		<label for="appearance">Aspetto</label>
		<textarea id="appearance" name="appearance" maxlength="5000" rows="6">{c.appearance ?? ''}</textarea>
		<span class="hint">Corporatura, viso, abiti, segni particolari: ciò che si vede.</span>
		{#if errors.appearance}<p class="field-error">{errors.appearance}</p>{/if}
	</div>
	<div>
		<label for="personality">Carattere</label>
		<textarea id="personality" name="personality" maxlength="5000" rows="6">{c.personality ?? ''}</textarea>
		{#if errors.personality}<p class="field-error">{errors.personality}</p>{/if}
	</div>
	<div>
		<label for="background">Background</label>
		<textarea id="background" name="background" maxlength="20000" rows="10">{c.background ?? ''}</textarea>
		<span class="hint">
			{data.backgroundPublic
				? 'Visibile a tutti i giocatori.'
				: 'Visibile solo a te e allo staff: gli altri lo scopriranno giocando.'}
		</span>
		{#if errors.background}<p class="field-error">{errors.background}</p>{/if}
	</div>
	<div class="portrait-row">
		{#if c.portraitUrl}<img src={c.portraitUrl} alt="Presta-volto attuale" />{/if}
		<div class="stack">
			<div>
				<label for="portrait">{c.portraitUrl ? 'Sostituisci il presta-volto' : 'Immagine del presta-volto'}</label>
				<input id="portrait" name="portrait" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
				<span class="hint">PNG, JPG, WEBP o GIF, massimo 5 MB. Meglio in verticale.</span>
				{#if errors.portrait}<p class="field-error">{errors.portrait}</p>{/if}
			</div>
			{#if c.portraitUrl}
				<label class="checkbox"><input type="checkbox" name="removePortrait" /><span>Rimuovi l'immagine</span></label>
			{/if}
			<div>
				<label for="portraitCredit">Presta-volto <span class="hint">facoltativo, es. nome dell'attore o dell'artista</span></label>
				<input id="portraitCredit" name="portraitCredit" type="text" maxlength="100" value={c.portraitCredit ?? ''} />
			</div>
		</div>
	</div>
	<div><button type="submit">Salva scheda</button></div>
</form>

<style>
	.edit {
		max-width: 760px;
	}
	.portrait-row {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.portrait-row img {
		width: 120px;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		border-radius: var(--radius);
	}
	.portrait-row .stack {
		flex: 1;
	}
</style>
