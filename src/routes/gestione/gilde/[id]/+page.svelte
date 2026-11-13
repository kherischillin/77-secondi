<script lang="ts">
	import IconPicker from '#lib/components/IconPicker.svelte';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { JOIN_MODE_LABELS } from '#lib/social.ts';

	let { data, form }: PageProps = $props();
	const g = $derived(data.guild);
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<svelte:head><title>{g.name} · Gestione gilde</title></svelte:head>

<p><a href="/gestione/gilde">← Tutte le gilde</a> · <a href="/gilde/{g.id}">Pagina pubblica</a></p>
<h1>{g.name}</h1>

{#if data.isNew && !form}<div class="alert success">Gilda creata, con i gradi predefiniti e la sua bacheca. Ora nomina un Capo dalla pagina pubblica (Aggiungi un membro) o personalizza i gradi qui sotto.</div>{/if}
{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<div class="layout">
	<form method="post" action="?/salva" enctype="multipart/form-data" class="stack card" use:enhance={keep}>
		<h2>Dati della gilda</h2>
		<div>
			<label for="name">Nome</label>
			<input id="name" name="name" type="text" maxlength="60" required value={g.name} />
		</div>
		<div>
			<label for="category">Tipo</label>
			<input id="category" name="category" type="text" maxlength="40" value={g.category} />
		</div>
		<div>
			<label for="joinMode">Come si entra</label>
			<select id="joinMode" name="joinMode">
				{#each Object.entries(JOIN_MODE_LABELS) as [value, label] (value)}
					<option {value} selected={g.joinMode === value}>{label}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="description">Descrizione</label>
			<textarea id="description" name="description" rows="4" maxlength="5000">{g.description}</textarea>
		</div>
		<IconPicker selected={g.icon} legend="Icona (in scheda e tra i presenti)" />
		<div class="symbol-row">
			{#if g.symbolUrl}<img src={g.symbolUrl} alt="Simbolo attuale" />{/if}
			<div>
				<label for="symbol">{g.symbolUrl ? 'Sostituisci il simbolo' : 'Simbolo'}</label>
				<input id="symbol" name="symbol" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
				{#if g.symbolUrl}<label class="checkbox"><input type="checkbox" name="removeSymbol" /><span>Rimuovi il simbolo</span></label>{/if}
			</div>
		</div>
		<label class="checkbox">
			<input type="checkbox" name="isActive" checked={g.isActive} />
			<span>Gilda attiva<span class="hint">Una gilda non attiva sparisce dall'elenco e dalle schede, ma i dati restano.</span></span>
		</label>
		<div><button type="submit">Salva</button></div>
	</form>

	<section class="stack">
		<h2>Gradi</h2>
		<p class="muted small">
			Livello più alto = grado più importante. Chi ha un grado "da capo" accetta candidature e gestisce
			i membri dei gradi inferiori al suo.
		</p>
		{#each data.ranks as r (r.id)}
			<div class="card rank">
				<form method="post" action="?/modificaGrado" class="row-form" use:enhance={keep}>
					<input type="hidden" name="id" value={r.id} />
					<label class="w-name">Nome <input name="name" value={r.name} maxlength="40" required /></label>
					<label class="w-num">Livello <input name="level" type="number" min="0" max="1000" value={r.level} /></label>
					<label class="checkbox w-check"><input type="checkbox" name="canManage" checked={r.canManage} /><span>Capo</span></label>
					<button type="submit">Salva</button>
				</form>
				<div class="rank-foot">
					<span class="muted small">{r.members} membr{r.members === 1 ? 'o' : 'i'}</span>
					{#if r.members === 0}
						<form method="post" action="?/eliminaGrado" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<button type="submit" class="link danger-link">Elimina grado</button>
						</form>
					{/if}
				</div>
			</div>
		{/each}
		<form method="post" action="?/nuovoGrado" class="card row-form" use:enhance>
			<label class="w-name">Nuovo grado <input name="name" maxlength="40" required /></label>
			<label class="w-num">Livello <input name="level" type="number" min="0" max="1000" value="5" /></label>
			<label class="checkbox w-check"><input type="checkbox" name="canManage" /><span>Capo</span></label>
			<button type="submit">Aggiungi</button>
		</form>
	</section>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.small {
		font-size: 0.85rem;
	}
	.symbol-row {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.symbol-row img {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		object-fit: cover;
	}
	.rank {
		padding: 0.75rem 1rem;
	}
	.row-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
		align-items: flex-end;
	}
	.row-form label {
		font-weight: 400;
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}
	.w-name {
		flex: 1 1 160px;
	}
	.w-num {
		flex: 0 0 90px;
	}
	.w-check {
		align-self: center;
	}
	.rank-foot {
		display: flex;
		justify-content: space-between;
		margin-top: 0.4rem;
	}
	.danger-link {
		color: var(--danger);
	}
</style>
