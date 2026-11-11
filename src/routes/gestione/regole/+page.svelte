<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let confirmDelete = $state<string | null>(null);

	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
	const notice = (section: string) => (form && form.section === section ? form : null);
	const statName = (id: number | null) => data.stats.find((s) => s.id === id)?.name ?? '—';
</script>

<svelte:head><title>Regole di gioco · Gestione</title></svelte:head>

<h1>Regole di gioco</h1>
<p class="muted intro">
	Il sistema è <strong>ibrido</strong>: nel gioco libero si descrive e basta; durante una <strong>quest</strong>
	avviata da un Master entrano in gioco i numeri. Le prove sommano un dado, la caratteristica collegata e il rango
	dell'abilità.
</p>

<!-- Impostazioni -->
<section class="block">
	<h2>Impostazioni</h2>
	{#if notice('impostazioni')?.success}<div class="alert success">{notice('impostazioni')?.success}</div>{/if}
	{#if notice('impostazioni')?.error}<div class="alert error">{notice('impostazioni')?.error}</div>{/if}
	<form method="post" action="?/impostazioni" class="card settings" use:enhance={keep}>
		<fieldset>
			<legend>Creazione del personaggio</legend>
			<label>Punti caratteristica da distribuire <input name="creationStatPoints" type="number" min="0" max="200" value={data.rules.creationStatPoints} /></label>
			<label>Ranghi di abilità da distribuire <input name="creationSkillPoints" type="number" min="0" max="200" value={data.rules.creationSkillPoints} /></label>
			<label>Rango massimo di un'abilità alla creazione <input name="creationSkillCap" type="number" min="0" max="50" value={data.rules.creationSkillCap} /></label>
		</fieldset>
		<fieldset>
			<legend>Avanzamento con i punti esperienza</legend>
			<label>Costo abilità (PX × nuovo rango) <input name="skillRankCost" type="number" min="1" max="10000" value={data.rules.skillRankCost} /></label>
			<label>Costo caratteristica (PX × nuovo valore) <input name="statPointCost" type="number" min="1" max="10000" value={data.rules.statPointCost} /></label>
			<p class="hint">Esempio: con costo abilità 10, passare da rango 2 a 3 costa 30 PX.</p>
		</fieldset>
		<fieldset>
			<legend>Quest e gioco libero</legend>
			<label>Dado delle prove in quest (facce) <input name="questDie" type="number" min="2" max="1000" value={data.rules.questDie} /></label>
			<label class="checkbox">
				<input type="checkbox" name="diceOutsideQuest" checked={data.rules.diceOutsideQuest} />
				<span>Permetti i tiri di dado (#2d6) anche fuori dalle quest<span class="hint">Spento: il gioco libero resta solo descrittivo.</span></span>
			</label>
			<label class="checkbox">
				<input type="checkbox" name="backgroundPublic" checked={data.rules.backgroundPublic} />
				<span>Background pubblico ("in chiaro")<span class="hint">Spento: il background lo vedono solo il proprietario e lo staff ("in scuro").</span></span>
			</label>
		</fieldset>
		<div><button type="submit">Salva impostazioni</button></div>
	</form>
</section>

<!-- Caratteristiche -->
<section class="block">
	<h2>Caratteristiche</h2>
	{#if notice('stats')?.success}<div class="alert success">{notice('stats')?.success}</div>{/if}
	{#if notice('stats')?.error}<div class="alert error">{notice('stats')?.error}</div>{/if}
	<div class="list">
		{#each data.stats as s (s.id)}
			<div class="card item">
				<form method="post" action="?/modificaCaratteristica" class="row-form" use:enhance={keep}>
					<input type="hidden" name="id" value={s.id} />
					<label class="w-name">Nome <input name="name" value={s.name} maxlength="40" required /></label>
					<label class="w-num">Partenza <input name="minValue" type="number" min="0" max="100" value={s.minValue} /></label>
					<label class="w-num">Massimo <input name="maxValue" type="number" min="1" max="100" value={s.maxValue} /></label>
					<label class="w-num">Ordine <input name="sortOrder" type="number" value={s.sortOrder} /></label>
					<label class="w-full">Descrizione <input name="description" value={s.description} maxlength="500" /></label>
					<div class="buttons">
						<button type="submit">Salva</button>
						{#if confirmDelete !== `stat${s.id}`}
							<button type="button" class="danger" onclick={() => (confirmDelete = `stat${s.id}`)}>Elimina</button>
						{/if}
					</div>
				</form>
				{#if confirmDelete === `stat${s.id}`}
					<form method="post" action="?/eliminaCaratteristica" class="confirm" use:enhance>
						<input type="hidden" name="id" value={s.id} />
						<span>Elimina «{s.name}»? Spariranno i valori di tutti i personaggi e le abilità collegate resteranno senza caratteristica.</span>
						<button type="submit" class="danger">Sì, elimina</button>
						<button type="button" class="secondary" onclick={() => (confirmDelete = null)}>Annulla</button>
					</form>
				{/if}
			</div>
		{/each}
	</div>
	<details class="add">
		<summary>Aggiungi una caratteristica</summary>
		<form method="post" action="?/nuovaCaratteristica" class="card row-form" use:enhance>
			<label class="w-name">Nome <input name="name" maxlength="40" required /></label>
			<label class="w-num">Partenza <input name="minValue" type="number" min="0" max="100" value="1" /></label>
			<label class="w-num">Massimo <input name="maxValue" type="number" min="1" max="100" value="10" /></label>
			<label class="w-num">Ordine <input name="sortOrder" type="number" value="0" /></label>
			<label class="w-full">Descrizione <input name="description" maxlength="500" /></label>
			<div class="buttons"><button type="submit">Crea</button></div>
		</form>
	</details>
</section>

<!-- Abilità -->
<section class="block">
	<h2>Abilità</h2>
	{#if notice('skills')?.success}<div class="alert success">{notice('skills')?.success}</div>{/if}
	{#if notice('skills')?.error}<div class="alert error">{notice('skills')?.error}</div>{/if}
	<div class="list">
		{#each data.skills as s (s.id)}
			<div class="card item">
				<form method="post" action="?/modificaAbilita" class="row-form" use:enhance={keep}>
					<input type="hidden" name="id" value={s.id} />
					<label class="w-name">Nome <input name="name" value={s.name} maxlength="40" required /></label>
					<label class="w-name">
						Caratteristica
						<select name="statId">
							<option value="">Nessuna</option>
							{#each data.stats as st (st.id)}<option value={st.id} selected={s.statId === st.id}>{st.name}</option>{/each}
						</select>
					</label>
					<label class="w-num">Rango max <input name="maxRank" type="number" min="1" max="100" value={s.maxRank} /></label>
					<label class="w-num">Ordine <input name="sortOrder" type="number" value={s.sortOrder} /></label>
					<label class="w-full">Descrizione <input name="description" value={s.description} maxlength="500" /></label>
					<div class="buttons">
						<button type="submit">Salva</button>
						{#if confirmDelete !== `skill${s.id}`}
							<button type="button" class="danger" onclick={() => (confirmDelete = `skill${s.id}`)}>Elimina</button>
						{/if}
					</div>
				</form>
				{#if confirmDelete === `skill${s.id}`}
					<form method="post" action="?/eliminaAbilita" class="confirm" use:enhance>
						<input type="hidden" name="id" value={s.id} />
						<span>Elimina «{s.name}» ({statName(s.statId)})? Spariranno i ranghi di tutti i personaggi.</span>
						<button type="submit" class="danger">Sì, elimina</button>
						<button type="button" class="secondary" onclick={() => (confirmDelete = null)}>Annulla</button>
					</form>
				{/if}
			</div>
		{/each}
	</div>
	<details class="add">
		<summary>Aggiungi un'abilità</summary>
		<form method="post" action="?/nuovaAbilita" class="card row-form" use:enhance>
			<label class="w-name">Nome <input name="name" maxlength="40" required /></label>
			<label class="w-name">
				Caratteristica
				<select name="statId">
					<option value="">Nessuna</option>
					{#each data.stats as st (st.id)}<option value={st.id}>{st.name}</option>{/each}
				</select>
			</label>
			<label class="w-num">Rango max <input name="maxRank" type="number" min="1" max="100" value="5" /></label>
			<label class="w-num">Ordine <input name="sortOrder" type="number" value="0" /></label>
			<label class="w-full">Descrizione <input name="description" maxlength="500" /></label>
			<div class="buttons"><button type="submit">Crea</button></div>
		</form>
	</details>
</section>

<style>
	.intro {
		max-width: 75ch;
	}
	.block {
		margin-top: 2rem;
	}
	.settings {
		display: grid;
		gap: 1rem;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	legend {
		font-family: var(--font-title);
		padding: 0 0.4rem;
	}
	.settings label:not(.checkbox) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		font-weight: 400;
	}
	.settings label:not(.checkbox) input {
		width: 110px;
	}
	.list {
		display: grid;
		gap: 0.5rem;
	}
	.item {
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
		flex: 1 1 180px;
	}
	.w-num {
		flex: 0 0 100px;
	}
	.w-full {
		flex: 1 1 100%;
	}
	.buttons {
		display: flex;
		gap: 0.5rem;
	}
	.confirm {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}
	.add {
		margin-top: 0.75rem;
	}
	.add summary {
		cursor: pointer;
		color: var(--accent);
		margin-bottom: 0.5rem;
	}
</style>
