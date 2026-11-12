<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { fullName } from '#lib/format.ts';
	import SheetFrame from '#lib/components/SheetFrame.svelte';
	import { prepareSheetText, SHEET_LIMITS, type SheetSection } from '#lib/sheet-html.ts';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form?.errors ?? {});
	const c = $derived(data.character);

	// Testi delle quattro sezioni personalizzabili, per l'anteprima dal vivo.
	let texts = $state<Record<SheetSection, string>>({ appearance: '', personality: '', background: '', offGame: '' });
	$effect.pre(() => {
		texts = {
			appearance: data.character.appearance ?? '',
			personality: data.character.personality ?? '',
			background: data.character.background ?? '',
			offGame: data.character.offGame ?? ''
		};
	});
	let preview = $state<Record<SheetSection, boolean>>({ appearance: false, personality: false, background: false, offGame: false });

	const sections: { key: SheetSection; label: string; rows: number; hint: () => string }[] = [
		{ key: 'appearance', label: 'Aspetto', rows: 8, hint: () => 'ON GAME. Corporatura, viso, abiti, segni particolari: ciò che si vede.' },
		{ key: 'personality', label: 'Carattere', rows: 8, hint: () => 'Modi di fare, pregi e difetti.' },
		{
			key: 'background',
			label: 'Background',
			rows: 12,
			hint: () => (data.backgroundPublic ? 'Visibile a tutti i giocatori.' : 'Visibile solo a te e allo staff: gli altri lo scopriranno giocando.')
		},
		{
			key: 'offGame',
			label: 'OFF Game',
			rows: 8,
			hint: () => 'Lo spazio del giocatore: presentazione, orari, preferenze di gioco, quello che vuoi. Il personaggio non lo sa.'
		}
	];
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
	<div class="howto">
		<strong>Aspetto, Carattere, Background e OFF Game</strong> si possono scrivere come testo semplice oppure
		personalizzare con <strong>HTML e CSS</strong> (anche un blocco <code>&lt;style&gt;</code>). Lo stile vale solo
		dentro quella sezione. JavaScript non è ammesso: script, <code>onclick</code> e simili vengono tolti al salvataggio.
		Immagini e caratteri esterni solo da indirizzi <code>https://</code>.
	</div>
	{#each sections as s (s.key)}
		<div class="field">
			<div class="field-head">
				<label for={s.key}>{s.label}</label>
				<button type="button" class="link" onclick={() => (preview[s.key] = !preview[s.key])}>
					{preview[s.key] ? 'Nascondi anteprima' : 'Anteprima'}
				</button>
			</div>
			<textarea
				id={s.key}
				name={s.key}
				class="code"
				maxlength={SHEET_LIMITS[s.key]}
				rows={s.rows}
				spellcheck="false"
				bind:value={texts[s.key]}
			></textarea>
			<span class="hint">{s.hint()} <span class="count">{texts[s.key].length}/{SHEET_LIMITS[s.key]}</span></span>
			{#if errors[s.key]}<p class="field-error">{errors[s.key]}</p>{/if}
			{#if preview[s.key]}
				{@const html = prepareSheetText(texts[s.key])}
				<div class="preview">
					{#if html}<SheetFrame {html} title="Anteprima di {s.label}" />{:else}<p class="muted">Niente da mostrare.</p>{/if}
				</div>
			{/if}
		</div>
	{/each}
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
		max-width: none;
	}
	.howto {
		font-size: 0.9rem;
		padding: 0.75rem 1rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		color: var(--text-muted);
	}
	.howto strong {
		color: var(--text);
	}
	.field-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
	}
	.code {
		font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
		font-size: 0.88rem;
		line-height: 1.5;
		tab-size: 2;
	}
	.count {
		float: right;
		font-variant-numeric: tabular-nums;
	}
	.preview {
		margin-top: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-raised);
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
