<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import ChatRoom from '#lib/components/ChatRoom.svelte';

	let { data, form }: PageProps = $props();
	let showStart = $state(false);
	let showRecord = $state(false);
	const recordError = $derived(form && 'recordError' in form ? form.recordError : '');
	$effect(() => {
		if (recordError) showRecord = true;
	});
	let confirmEnd = $state(false);
	const questError = $derived(form && 'questError' in form ? form.questError : '');
	const roomError = $derived(form && 'roomError' in form ? form.roomError : '');
	const roomSuccess = $derived(form && 'roomSuccess' in form ? form.roomSuccess : '');
	const itemError = $derived(form && 'itemError' in form ? form.itemError : '');
	let showItem = $state(false);
	let showRoom = $state(false);
	let hours = $state(1);
	$effect(() => {
		if (itemError) showItem = true;
	});

	const clock = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
	const money = (n: number, currency: string) => `${n.toLocaleString('it-IT', { useGrouping: 'always' })} ${currency}`;
</script>

<svelte:head><title>{data.location.name} · {data.siteName}</title></svelte:head>

<div class="head">
	<div>
		{#if data.map}<a class="back" href="/gioco/mappa/{data.map.id}">← {data.map.name}</a>{/if}
		<h1>{data.location.name}{#if data.room}<span class="private-badge">stanza privata</span>{/if}</h1>
	</div>
	{#if data.weather}
		<p class="weather" title={data.weather.manual ? 'Meteo deciso dallo staff' : 'Meteo della zona'}>
			<span aria-hidden="true">{data.weather.icon}</span>
			{data.weather.label}{#if data.weather.temperature !== null}, {data.weather.temperature}°C{/if}
			<span class="moon" title={data.weather.moon.name}><span aria-hidden="true">{data.weather.moon.icon}</span> {data.weather.moon.name}</span>
		</p>
	{/if}
</div>

{#if data.location.description || data.location.imageUrl}
	<details class="description card" open>
		<summary>Descrizione del luogo</summary>
		<div class="desc-body">
			{#if data.location.imageUrl}<img src={data.location.imageUrl} alt="" />{/if}
			{#if data.location.description}<p>{data.location.description}</p>{/if}
		</div>
	</details>
{/if}

{#if roomError}<div class="alert error">{roomError}</div>{/if}
{#if roomSuccess}<div class="alert success">{roomSuccess}</div>{/if}

{#if data.locked}
	{@const r = data.room}
	<section class="card room-lock">
		{#if r?.booking}
			<h2>Stanza occupata</h2>
			<p>È prenotata da <strong>{r.booking.owner.name}</strong> fino alle <strong>{clock(r.booking.endsAt)}</strong>. Si entra solo su invito.</p>
		{:else if r}
			<h2>Stanza libera</h2>
			<p>
				Prenotala per giocare in privato: entrano solo i personaggi che inviti, e chi prenota dopo non legge quello che è stato scritto.
			</p>
			<form method="post" action="?/prenota" class="row book" use:enhance>
				<label>
					Ore
					<select name="hours" bind:value={hours}>
						{#each Array.from({ length: r.maxHours }, (_, i) => i + 1) as h (h)}<option value={h}>{h}</option>{/each}
					</select>
				</label>
				<button type="submit">
					Prenota{#if r.hourlyPrice > 0}{' '}per {money(r.hourlyPrice * hours, r.currency)}{:else}{' '}(gratis){/if}
				</button>
			</form>
			<p class="muted small">Hai in tasca {money(r.cash, r.currency)}.{#if r.hourlyPrice > 0}{' '}Costo: {money(r.hourlyPrice, r.currency)} all'ora.{/if}</p>
		{/if}
	</section>
{:else}
{#if data.room?.booking}
	{@const r = data.room}
	{@const b = data.room.booking}
	<section class="room-bar">
		<span>
			Prenotata da <strong>{b.owner.name}</strong> fino alle <strong>{clock(b.endsAt)}</strong>
			{#if b.invited.length}· invitati: {b.invited.map((i) => i.name).join(', ')}{/if}
		</span>
		{#if r.isOwner}
			<button type="button" class="link" onclick={() => (showRoom = !showRoom)}>{showRoom ? 'Chiudi' : 'Gestisci la stanza'}</button>
		{/if}
	</section>
	{#if r.isOwner && showRoom}
		<section class="card room-panel stack">
			<form method="post" action="?/invita" class="row" use:enhance>
				<label for="invite" class="visually-hidden">Nome del personaggio da invitare</label>
				<input id="invite" name="name" type="text" maxlength="80" placeholder="Nome del personaggio da invitare" required />
				<button type="submit">Invita</button>
			</form>
			{#if b.invited.length}
				<ul class="invited">
					{#each b.invited as i (i.id)}
						<li>
							{i.name}
							<form method="post" action="?/rimuovi" use:enhance>
								<input type="hidden" name="characterId" value={i.id} />
								<button type="submit" class="link">Ritira l'invito</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="row">
				<form method="post" action="?/prolunga" class="row" use:enhance>
					<select name="hours" aria-label="Ore da aggiungere">
						{#each Array.from({ length: r.maxHours }, (_, i) => i + 1) as h (h)}<option value={h}>+{h} {h === 1 ? 'ora' : 'ore'}</option>{/each}
					</select>
					<button type="submit" class="secondary">Prolunga{#if r.hourlyPrice > 0}{' '}({money(r.hourlyPrice, r.currency)}/ora){/if}</button>
				</form>
				<form method="post" action="?/libera" use:enhance>
					<button type="submit" class="secondary">Libera la stanza</button>
				</form>
			</div>
		</section>
	{/if}
{/if}

{#if data.quest}
	<section class="quest-banner" aria-live="polite">
		<div>
			<span class="label">Quest in corso</span>
			<strong>{data.quest.title}</strong>
			{#if data.quest.masterName}<span class="muted"> · Master: {data.quest.masterName}</span>{/if}
			<p class="muted small">Durante la quest valgono le regole numeriche: le prove si tirano dal pannello sotto la chat.</p>
		</div>
		{#if data.can.master}
			{#if !confirmEnd}
				<button type="button" class="secondary" onclick={() => (confirmEnd = true)}>Termina quest</button>
			{:else}
				<form method="post" action="?/terminaQuest" class="row" use:enhance>
					<button type="submit">Conferma fine quest</button>
					<button type="button" class="secondary" onclick={() => (confirmEnd = false)}>Annulla</button>
				</form>
			{/if}
		{/if}
	</section>
{:else if data.can.master}
	<div class="master-tools">
		{#if !showStart}
			<button type="button" class="secondary" onclick={() => (showStart = true)}>Avvia una quest in questo luogo</button>
		{:else}
			<form
				method="post"
				action="?/avviaQuest"
				class="row"
				use:enhance={() => async ({ update }) => {
					await update();
					showStart = false;
				}}
			>
				<label for="questTitle" class="visually-hidden">Titolo della quest</label>
				<input id="questTitle" name="title" type="text" maxlength="100" placeholder="Titolo della quest" required />
				<button type="submit">Avvia</button>
				<button type="button" class="secondary" onclick={() => (showStart = false)}>Annulla</button>
			</form>
		{/if}
	</div>
{/if}
{#if questError}<div class="alert error">{questError}</div>{/if}

<div class="record">
	{#if data.usableItems.length}
		<button type="button" class="link" onclick={() => (showItem = !showItem)}>{showItem ? 'Chiudi' : 'Usa un oggetto'}</button>
		<span class="muted">·</span>
	{/if}
	<button type="button" class="link" onclick={() => (showRecord = !showRecord)}>
		{showRecord ? 'Chiudi' : 'Registra la giocata'}
	</button>
	{#if showItem}
		<form
			method="post"
			action="?/usa"
			class="card stack record-form"
			use:enhance={() => async ({ result, update }) => {
				await update();
				if (result.type === 'success') showItem = false;
			}}
		>
			<p class="muted small">L'oggetto compare in chat insieme alla tua azione. Quelli consumabili si esauriscono.</p>
			<div class="row">
				<label class="grow">
					Oggetto
					<select name="itemId" required>
						{#each data.usableItems as i (i.id)}
							<option value={i.id} disabled={i.consumable && i.equipped}>{i.name}{i.quantity > 1 ? ` (×${i.quantity})` : ''}{i.consumable ? ' · consumabile' : ''}{i.equipped ? ' · indossato' : ''}</option>
						{/each}
					</select>
				</label>
				<label>Tag <input name="tag" type="text" maxlength="40" placeholder="facoltativo" /></label>
			</div>
			<label>Azione <textarea name="text" rows="2" maxlength="2000" placeholder="Es. Selene apre il medikit e fascia la ferita di Bran."></textarea></label>
			{#if itemError}<p class="field-error">{itemError}</p>{/if}
			<div><button type="submit">Usa in chat</button></div>
		</form>
	{/if}
	{#if showRecord}
		<form method="post" action="?/registra" class="card stack record-form" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<p class="muted small">
				Salva una copia permanente di questo tratto di chat (senza sussurri né messaggi nascosti), con l'elenco dei partecipanti.
			</p>
			<div class="row">
				<label class="grow">Titolo <input name="title" type="text" maxlength="120" required placeholder="Es. L'incontro alla locanda" /></label>
				<label>
					Cosa registrare
					<select name="span">
						{#if data.recordableQuest}
							<option value="quest:{data.recordableQuest.id}">Tutta la quest «{data.recordableQuest.title}»{data.recordableQuest.active ? ' (in corso)' : ''}</option>
						{/if}
						<option value="30">Ultimi 30 minuti</option>
						<option value="60">Ultima ora</option>
						<option value="120" selected={!data.recordableQuest}>Ultime 2 ore</option>
						<option value="180">Ultime 3 ore</option>
						<option value="360">Ultime 6 ore</option>
						<option value="720">Ultime 12 ore</option>
					</select>
				</label>
			</div>
			<label class="checkbox"><input type="checkbox" name="isPublic" /><span>Pubblica<span class="hint">Leggibile da tutti gli iscritti e mostrata nelle schede dei partecipanti. Altrimenti solo partecipanti e Master.</span></span></label>
			{#if recordError}<p class="field-error">{recordError}</p>{/if}
			<div><button type="submit">Registra</button></div>
		</form>
	{/if}
</div>

{#key data.location.id}
	<ChatRoom
		locationId={data.location.id}
		me={data.me}
		initialMessages={data.history.messages}
		initialHasMore={data.history.hasMore}
		initialPresent={data.present}
		can={data.can}
		quest={data.quest}
		questDie={data.questDie}
		diceAllowed={data.diceAllowed}
		statsAllocated={data.statsAllocated}
		checkOptions={data.checkOptions}
	/>
{/key}
{/if}

<style>
	.weather {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.moon {
		padding-left: 0.6rem;
		border-left: 1px solid var(--border);
	}
	.private-badge {
		font-family: var(--font-body, inherit);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 999px;
		padding: 0.1rem 0.6rem;
		margin-left: 0.75rem;
		vertical-align: middle;
	}
	.room-lock {
		max-width: 640px;
	}
	.room-lock h2 {
		margin-top: 0;
	}
	.book label {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin: 0;
		font-weight: 400;
	}
	.book select {
		width: auto;
	}
	.room-bar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: center;
		padding: 0.6rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}
	.room-panel {
		margin-bottom: 1rem;
		max-width: none;
	}
	.room-panel select {
		width: auto;
	}
	.invited {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.invited li {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.25rem 0;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 0 1rem;
		flex-wrap: wrap;
	}
	.back {
		font-size: 0.9rem;
		text-decoration: none;
	}
	h1 {
		margin-bottom: 0.75rem;
	}
	.description {
		margin-bottom: 1.25rem;
		padding: 0.75rem 1rem;
	}
	summary {
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.desc-body {
		display: flex;
		gap: 1rem;
		margin-top: 0.75rem;
		align-items: flex-start;
	}
	.desc-body img {
		width: 180px;
		max-width: 35%;
		border-radius: var(--radius);
		object-fit: cover;
	}
	.desc-body p {
		margin: 0;
		white-space: pre-line;
	}
	.quest-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		border: 1px solid var(--c-system);
		background: color-mix(in srgb, var(--c-system) 14%, transparent);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin-bottom: 1.25rem;
	}
	.quest-banner .label {
		display: block;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--c-system-text);
		font-weight: 700;
	}
	.quest-banner p {
		margin: 0.25rem 0 0;
	}
	.small {
		font-size: 0.85rem;
	}
	.record {
		margin-bottom: 1rem;
		text-align: right;
	}
	.record-form {
		text-align: left;
		margin-top: 0.5rem;
		max-width: none;
	}
	.record-form .row label {
		font-weight: 400;
		font-size: 0.9rem;
		margin: 0;
	}
	.record-form .grow {
		flex: 1 1 260px;
	}
	.master-tools {
		margin-bottom: 1rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.row input {
		flex: 1 1 220px;
		width: auto;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	@media (max-width: 600px) {
		.desc-body {
			flex-direction: column;
		}
		.desc-body img {
			width: 100%;
			max-width: 100%;
		}
	}
</style>
