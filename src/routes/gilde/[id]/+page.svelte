<script lang="ts">
	import JobIcon from '#lib/components/JobIcon.svelte';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDate, fullName } from '#lib/format.ts';
	import { JOIN_MODE_LABELS } from '#lib/social.ts';

	let { data, form }: PageProps = $props();
	const g = $derived(data.guild);
	let confirmLeave = $state(false);
	let showTexts = $state(false);

	// Membri raggruppati per grado, dal più alto.
	const byRank = $derived(
		data.ranks
			.map((r) => ({ rank: r, members: data.members.filter((m) => m.rankId === r.id) }))
			.filter((x) => x.members.length > 0)
	);
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<svelte:head><title>{g.name} · Gilde</title></svelte:head>

<p><a href="/gilde">← Tutte le gilde</a></p>

<header class="top">
	<div class="symbol">
		{#if g.symbolUrl}<img src={g.symbolUrl} alt="Simbolo di {g.name}" />{:else}<JobIcon icon={g.icon} size={44} />{/if}
	</div>
	<div>
		<h1>{g.name}</h1>
		<p class="muted">
			{#if g.category}{g.category}{' · '}{/if}{JOIN_MODE_LABELS[g.joinMode]} · {data.members.length} membr{data.members.length === 1 ? 'o' : 'i'}
			{#if !g.isActive}<span class="badge danger">non attiva</span>{/if}
		</p>
		{#if data.me.isStaff}<a href="/gestione/gilde/{g.id}">Gestione della gilda (staff)</a>{/if}
	</div>
</header>

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<!-- Il mio rapporto con la gilda -->
<section class="card me">
	{#if !data.me.hasCharacter}
		<p class="muted">Scegli un personaggio con cui giocare per entrare in una gilda.</p>
	{:else if data.me.isMember}
		<p>{data.me.characterName} fa parte della gilda con il grado di <strong>{data.me.rankName}</strong>.</p>
		{#if !confirmLeave}
			<button type="button" class="secondary" onclick={() => (confirmLeave = true)}>Lascia la gilda</button>
		{:else}
			<form method="post" action="?/esci" class="row" use:enhance>
				<span>Sei sicuro? Per rientrare servirà di nuovo l'approvazione.</span>
				<button type="submit" class="danger">Sì, esco</button>
				<button type="button" class="secondary" onclick={() => (confirmLeave = false)}>Annulla</button>
			</form>
		{/if}
	{:else if data.me.applied}
		<p>La candidatura di {data.me.characterName} è in attesa di risposta.</p>
		<form method="post" action="?/ritira" use:enhance><button type="submit" class="secondary">Ritira la candidatura</button></form>
	{:else if g.joinMode === 'open'}
		{#if data.me.jobName}<p class="muted small">Entrando lascerai il lavoro libero ({data.me.jobName}).</p>{/if}
		<form method="post" action="?/entra" use:enhance><button type="submit">Entra nella gilda</button></form>
	{:else if g.joinMode === 'apply'}
		<form method="post" action="?/entra" class="stack" use:enhance>
			<label for="message">Candidatura di {data.me.characterName} <span class="hint">facoltativo: perché vuoi entrare</span></label>
			<textarea id="message" name="message" rows="3" maxlength="1000"></textarea>
			{#if data.me.jobName}<p class="muted small">Se verrai accettato lascerai il lavoro libero ({data.me.jobName}).</p>{/if}
			<div><button type="submit">Invia candidatura</button></div>
		</form>
	{:else}
		<p class="muted">In questa gilda si entra solo su invito dei capi: va conquistato in gioco.</p>
	{/if}
</section>

<div class="layout">
	<div class="stack">
		{#if g.description}
			<section><h2>Descrizione</h2><p class="text">{g.description}</p></section>
		{/if}
		<section>
			<h2>Statuto</h2>
			{#if g.statute}<p class="text">{g.statute}</p>{:else}<p class="muted">Lo statuto non è ancora stato scritto.</p>{/if}
		</section>
	</div>

	<section class="card">
		<h2>Membri</h2>
		{#if byRank.length === 0}
			<p class="muted">Nessun membro.</p>
		{/if}
		{#each byRank as group (group.rank.id)}
			<h3>{group.rank.name}</h3>
			<ul class="members">
				{#each group.members as m (m.characterId)}
					<li>
						<a href="/scheda/{m.characterId}">{fullName(m)}</a>
						{#if m.actionable}
							<div class="member-tools">
								<form method="post" action="?/grado" class="inline" use:enhance={keep}>
									<input type="hidden" name="characterId" value={m.characterId} />
									<select name="rankId" aria-label="Grado di {fullName(m)}">
										{#each data.ranks.filter((r) => r.assignable) as r (r.id)}
											<option value={r.id} selected={r.id === m.rankId}>{r.name}</option>
										{/each}
									</select>
									<button type="submit" class="link">Cambia</button>
								</form>
								<form method="post" action="?/espelli" class="inline" use:enhance>
									<input type="hidden" name="characterId" value={m.characterId} />
									<button type="submit" class="link danger-link">Espelli</button>
								</form>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/each}
	</section>
</div>

{#if data.me.canManage}
	<section class="leader">
		<h2>Pannello dei capi</h2>

		<div class="grid">
			<div class="card stack">
				<h3>Candidature</h3>
				{#if data.applications.length === 0}
					<p class="muted">Nessuna candidatura in attesa.</p>
				{/if}
				{#each data.applications as a (a.id)}
					<div class="application">
						<p><a href="/scheda/{a.characterId}">{fullName(a)}</a> <span class="muted small">· {formatDate(a.createdAt)}</span></p>
						{#if a.message}<p class="text small">{a.message}</p>{/if}
						<div class="row">
							<form method="post" action="?/accetta" use:enhance><input type="hidden" name="id" value={a.id} /><button type="submit">Accetta</button></form>
							<form method="post" action="?/rifiuta" use:enhance><input type="hidden" name="id" value={a.id} /><button type="submit" class="secondary">Rifiuta</button></form>
						</div>
					</div>
				{/each}
			</div>

			<form method="post" action="?/aggiungi" class="card stack" use:enhance>
				<h3>Aggiungi un membro</h3>
				<p class="muted small">Per chi è stato reclutato in gioco. Entra con il grado più basso.</p>
				<label for="addName">Nome del personaggio</label>
				<input id="addName" name="name" type="text" required />
				<div><button type="submit">Aggiungi</button></div>
			</form>
		</div>

		<button type="button" class="secondary spaced" onclick={() => (showTexts = !showTexts)}>
			{showTexts ? 'Chiudi' : 'Modifica descrizione e statuto'}
		</button>
		{#if showTexts}
			<form method="post" action="?/testi" class="card stack texts" use:enhance={keep}>
				<div>
					<label for="description">Descrizione</label>
					<textarea id="description" name="description" rows="4" maxlength="5000">{g.description}</textarea>
				</div>
				<div>
					<label for="statute">Statuto</label>
					<textarea id="statute" name="statute" rows="12" maxlength="30000">{g.statute}</textarea>
				</div>
				<div><button type="submit">Salva</button></div>
			</form>
		{/if}
	</section>
{/if}

<style>
	.top {
		display: flex;
		gap: 1.25rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.top h1 {
		margin: 0;
	}
	.top p {
		margin: 0.2rem 0;
	}
	.symbol {
		flex: 0 0 96px;
		height: 96px;
		border-radius: 50%;
		overflow: hidden;
		border: 1px solid var(--border);
		display: grid;
		place-items: center;
		background: var(--bg-sunken);
		font-family: var(--font-title);
		font-size: 2.6rem;
		color: var(--accent);
	}
	.symbol img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.me {
		margin-bottom: 1.5rem;
	}
	.me p {
		margin-top: 0;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(240px, 2fr);
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.text {
		white-space: pre-line;
	}
	h3 {
		font-size: 1rem;
		color: var(--accent);
		margin: 1rem 0 0.3rem;
	}
	.members {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.members li {
		padding: 0.3rem 0;
		border-bottom: 1px solid var(--border);
	}
	.member-tools {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-top: 0.25rem;
	}
	.inline {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
	}
	.inline select {
		width: auto;
		padding: 0.2rem 0.4rem;
		font-size: 0.85rem;
	}
	.danger-link {
		color: var(--danger);
	}
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.leader {
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
	.application {
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.5rem;
	}
	.application p {
		margin: 0 0 0.3rem;
	}
	.small {
		font-size: 0.85rem;
	}
	.spaced {
		margin-top: 1rem;
	}
	.texts {
		margin-top: 1rem;
		max-width: 820px;
	}
</style>
