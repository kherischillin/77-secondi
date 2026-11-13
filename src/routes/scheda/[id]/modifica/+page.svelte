<script lang="ts">
	import JobIcon from '#lib/components/JobIcon.svelte';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { fullName } from '#lib/format.ts';
	import SheetFrame from '#lib/components/SheetFrame.svelte';
	import { prepareSheetText, SHEET_LIMITS, type SheetSection } from '#lib/sheet-html.ts';
	import { PROFILE_FIELDS, PROFILE_MAX } from '#lib/profile.ts';
	import { checkPortraitUrl } from '#lib/portrait.ts';
	import Avatar from '#lib/components/Avatar.svelte';

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
	// Presta-volto: link con anteprima e controllo immediato del sito.
	let portraitUrl = $state('');
	$effect.pre(() => {
		portraitUrl = data.character.portraitLink;
	});
	let removeLegacy = $state(false);

	// Avatar quadrato, con anteprima alle misure in cui comparirà.
	let avatarUrl = $state('');
	$effect.pre(() => {
		avatarUrl = data.character.avatarLink;
	});
	const avatarCheck = $derived(avatarUrl.trim() ? checkPortraitUrl(avatarUrl, data.portrait.hosts) : null);
	const avatarProblem = $derived(avatarCheck && !avatarCheck.ok ? avatarCheck.error : null);
	const avatarSrc = $derived(avatarCheck?.ok ? avatarCheck.url : null);
	let imgError = $state(false);
	let natural = $state<{ w: number; h: number } | null>(null);
	const linkCheck = $derived(portraitUrl.trim() ? checkPortraitUrl(portraitUrl, data.portrait.hosts) : null);
	const linkProblem = $derived(linkCheck && !linkCheck.ok ? linkCheck.error : null);
	const previewSrc = $derived(
		linkCheck?.ok ? linkCheck.url : !portraitUrl.trim() && !removeLegacy ? data.character.legacyPortraitUrl : null
	);

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

<form method="post" class="stack card edit" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<div class="top-fields">
		<fieldset class="portrait-field">
			<legend>Presta-volto</legend>
			<div class="portrait-box" style:--pw="{data.portrait.maxWidth}px" style:--pr="{data.portrait.maxWidth} / {data.portrait.maxHeight}">
				{#if previewSrc && !imgError}
					<img
						src={previewSrc}
						alt="Anteprima del presta-volto"
						referrerpolicy="no-referrer"
						onload={(e) => {
							const img = e.currentTarget as HTMLImageElement;
							natural = { w: img.naturalWidth, h: img.naturalHeight };
						}}
						onerror={() => (imgError = true)}
					/>
				{:else}
					<span class="muted small">{imgError ? 'Immagine non raggiungibile' : 'Nessuna immagine'}</span>
				{/if}
			</div>
			<div class="stack">
				<div>
					<label for="portraitUrl">Link all'immagine</label>
					<input
						id="portraitUrl"
						name="portraitUrl"
						type="url"
						inputmode="url"
						maxlength="500"
						placeholder="https://i.imgur.com/..."
						bind:value={portraitUrl}
						oninput={() => {
							imgError = false;
							natural = null;
						}}
					/>
					{#if errors.portraitUrl}<p class="field-error">{errors.portraitUrl}</p>{/if}
					{#if linkProblem}<p class="field-error">{linkProblem}</p>{/if}
					<span class="hint">
						Link diretto all'immagine, che inizia con <code>https://</code>. Siti ammessi:
						{data.portrait.hosts.join(', ') || 'nessuno (chiedi allo staff)'}.
					</span>
				</div>
				<p class="hint">
					Nella scheda l'immagine riempie un riquadro di <strong>{data.portrait.maxWidth} × {data.portrait.maxHeight} px</strong>:
					viene adattata senza deformarla e, se ha proporzioni diverse, i bordi in eccesso vengono tagliati
					(l'anteprima qui accanto mostra il risultato).
					{#if natural}<br />Questa immagine misura {natural.w} × {natural.h} px{natural.w * data.portrait.maxHeight === natural.h * data.portrait.maxWidth ? ': proporzioni perfette.' : natural.w < data.portrait.maxWidth ? ': è più piccola del riquadro, potrebbe sembrare sgranata.' : '.'}{/if}
				</p>
				{#if c.legacyPortraitUrl && !portraitUrl}
					<label class="checkbox"><input type="checkbox" name="removePortrait" bind:checked={removeLegacy} /><span>Rimuovi l'immagine caricata in passato</span></label>
				{/if}
				<div>
					<label for="portraitCredit">Presta-volto <span class="hint">facoltativo, es. nome dell'attore o dell'artista</span></label>
					<input id="portraitCredit" name="portraitCredit" type="text" maxlength="100" value={c.portraitCredit ?? ''} />
				</div>
			</div>
		</fieldset>

		<fieldset class="profile">
			<legend>Dati anagrafici <span class="hint">compaiono accanto al nome; lascia vuoto ciò che non vuoi mostrare</span></legend>
			<div class="profile-grid">
				{#each PROFILE_FIELDS as f (f.key)}
					<div>
						<label for="profile_{f.key}">{f.label}</label>
						<input
							id="profile_{f.key}"
							name="profile_{f.key}"
							type="text"
							maxlength={PROFILE_MAX}
							placeholder={f.placeholder}
							value={(c.profile as Record<string, string>)[f.key] ?? ''}
						/>
						{#if errors[`profile_${f.key}`]}<p class="field-error">{errors[`profile_${f.key}`]}</p>{/if}
					</div>
				{/each}
				<div>
					<span class="label-like">Occupazione</span>
					<p class="auto">
						{#if data.occupation.length}{#each data.occupation as b (b.title)}<JobIcon icon={b.icon} size={16} /> {b.label} {/each}{:else}Nessun lavoro{/if}
						<span class="hint">viene dalla gilda o dal lavoro scelto in <a href="/lavori">Uffici → Lavori</a></span>
					</p>
				</div>
			</div>
		</fieldset>

		<fieldset class="avatar-field">
			<legend>Avatar</legend>
			<div class="avatar-previews" aria-label="Anteprima dell'avatar">
				<Avatar src={avatarSrc} name={c.name} size={56} />
				<Avatar src={avatarSrc} name={c.name} size={34} />
				<Avatar src={avatarSrc} name={c.name} size={26} />
			</div>
			<div class="stack">
				<div>
					<label for="avatarUrl">Link all'immagine dell'avatar</label>
					<input id="avatarUrl" name="avatarUrl" type="url" inputmode="url" maxlength="500" placeholder="https://i.imgur.com/..." bind:value={avatarUrl} />
					{#if errors.avatarUrl}<p class="field-error">{errors.avatarUrl}</p>{/if}
					{#if avatarProblem}<p class="field-error">{avatarProblem}</p>{/if}
				</div>
				<p class="hint">
					Immagine <strong>quadrata</strong>, piccola, accanto al nome del personaggio in bacheca (56 px), nei presenti e in
					chat (26–36 px) e sulla mappa. Va bene qualsiasi misura a partire da 100 × 100 px: se non è quadrata viene ritagliata al centro.
					Lasciando vuoto si vede l'iniziale del nome. Stessi siti ammessi del presta-volto.
				</p>
			</div>
		</fieldset>
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
	<div><button type="submit">Salva scheda</button></div>
</form>

<style>
	.label-like {
		display: block;
		font-weight: 600;
		margin-bottom: 0.3rem;
	}
	.auto {
		margin: 0;
		padding: 0.55rem 0;
	}
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
	.top-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
	}
	@media (max-width: 800px) {
		.top-fields {
			grid-template-columns: 1fr;
		}
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem;
		margin: 0;
		min-width: 0;
	}
	legend {
		padding: 0 0.4rem;
		font-weight: 600;
	}
	.portrait-field {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.portrait-field .stack {
		flex: 1;
		min-width: 0;
	}
	.portrait-box {
		flex: 0 0 auto;
		width: min(var(--pw), 40%);
		aspect-ratio: var(--pr);
		display: grid;
		place-items: center;
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		background: var(--bg-sunken);
		text-align: center;
		overflow: hidden;
	}
	.portrait-box img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.profile-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
		gap: 0.6rem 0.9rem;
	}
	.hint code {
		font-size: 0.85em;
	}
	.avatar-field {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		grid-column: 1 / -1;
	}
	.avatar-field .stack {
		flex: 1;
		min-width: 0;
	}
	.avatar-previews {
		display: flex;
		align-items: flex-end;
		gap: 0.6rem;
		flex: 0 0 auto;
	}
	@media (max-width: 600px) {
		.avatar-field {
			flex-direction: column;
		}
	}
</style>
