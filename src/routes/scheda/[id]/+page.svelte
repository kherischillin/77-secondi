<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDate, formatDateTime, fullName } from '#lib/format.ts';
	import ReportButton from '#lib/components/ReportButton.svelte';

	let { data, form }: PageProps = $props();

	const c = $derived(data.character);
	const owner = $derived(data.viewer.isOwner);
	const statName = (id: number | null) => data.stats.find((s) => s.id === id)?.name ?? null;

	// Distribuzione iniziale: valori modificabili con contatori in tempo reale.
	let alloc = $state<{ stats: Record<number, number>; skills: Record<number, number> }>({ stats: {}, skills: {} });
	$effect.pre(() => {
		alloc = {
			stats: Object.fromEntries(data.stats.map((s) => [s.id, s.minValue])),
			skills: Object.fromEntries(data.skills.map((s) => [s.id, 0]))
		};
	});
	const statUsed = $derived(data.stats.reduce((n, s) => n + ((alloc.stats[s.id] ?? s.minValue) - s.minValue), 0));
	const skillUsed = $derived(data.skills.reduce((n, s) => n + (alloc.skills[s.id] ?? 0), 0));

	let showStaff = $state(false);
	const message = $derived(form && 'success' in form ? form.success : null);
	const errorMsg = $derived(form && 'error' in form ? form.error : null);
</script>

<svelte:head><title>{fullName(c)} · Scheda</title></svelte:head>

<article class="sheet">
	<header class="top">
		<div class="portrait">
			{#if c.portraitUrl}
				<img src={c.portraitUrl} alt="Presta-volto di {fullName(c)}" />
			{:else}
				<div class="noportrait" aria-hidden="true">{c.name.slice(0, 1)}</div>
			{/if}
			{#if c.portraitCredit}<p class="muted small credit">Presta-volto: {c.portraitCredit}</p>{/if}
		</div>
		<div class="intro">
			<p class="label">Scheda del personaggio</p>
			<h1>{fullName(c)}</h1>
			{#if c.bio}<p class="bio">{c.bio}</p>{/if}
			<p class="muted small">In gioco dal {formatDate(c.createdAt)}</p>
			{#if data.guilds.length}
				<ul class="guilds">
					{#each data.guilds as g (g.id)}
						<li>
							<a href="/gilde/{g.id}">
								{#if g.symbolUrl}<img src={g.symbolUrl} alt="" />{/if}
								<span><strong>{g.name}</strong> <span class="muted">· {g.rank}</span></span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			{#if data.viewer.canEdit}
				<a class="button secondary" href="/scheda/{c.id}/modifica">Modifica descrizione</a>
			{/if}
			{#if !owner}<p class="report-sheet"><ReportButton targetType="character" targetId={c.id} label="Segnala questa scheda" /></p>{/if}
		</div>
	</header>

	{#if message}<div class="alert success">{message}</div>{/if}
	{#if errorMsg}<div class="alert error">{errorMsg}</div>{/if}

	<section class="grid texts">
		<div class="card">
			<h2>Aspetto</h2>
			<p class="hint-on">Ciò che gli altri personaggi vedono in gioco.</p>
			{#if c.appearance}<p class="text">{c.appearance}</p>{:else}<p class="muted">Non ancora descritto.</p>{/if}
		</div>
		<div class="card">
			<h2>Carattere</h2>
			{#if c.personality}<p class="text">{c.personality}</p>{:else}<p class="muted">Non ancora descritto.</p>{/if}
		</div>
		<div class="card">
			<h2>Background</h2>
			{#if c.backgroundHidden}
				<p class="muted">Il passato di questo personaggio è da scoprire giocando.</p>
			{:else if c.background}
				<p class="text">{c.background}</p>
				{#if !data.rules.backgroundPublic}<p class="muted small">Visibile solo a te e allo staff.</p>{/if}
			{:else}
				<p class="muted">Non ancora scritto.</p>
			{/if}
		</div>
	</section>

	<!-- Parte numerica: conta solo nelle quest. -->
	<section class="numbers">
		<div class="numbers-head">
			<h2>Caratteristiche e abilità</h2>
			<p class="muted small">Contano solo nelle quest: nel gioco libero si descrive.</p>
		</div>

		{#if owner && !c.statsAllocated}
			<form method="post" action="?/distribuisci" class="card stack allocate" use:enhance>
				<p>
					<strong>Distribuisci i punti iniziali.</strong> Si fa una volta sola: dopo, il personaggio migliora con i punti esperienza.
				</p>
				<div class="counters">
					<span class:over={statUsed > data.rules.creationStatPoints}>Caratteristiche: {statUsed}/{data.rules.creationStatPoints}</span>
					<span class:over={skillUsed > data.rules.creationSkillPoints}>Abilità: {skillUsed}/{data.rules.creationSkillPoints}</span>
				</div>
				<div class="grid">
					<div>
						<h3>Caratteristiche</h3>
						{#each data.stats as s (s.id)}
							<label class="num">
								<span>{s.name} <span class="hint">{s.minValue}–{s.maxValue}</span></span>
								<input type="number" name="stat_{s.id}" min={s.minValue} max={s.maxValue} bind:value={alloc.stats[s.id]} />
							</label>
						{/each}
					</div>
					<div>
						<h3>Abilità <span class="hint">massimo {data.rules.creationSkillCap} alla creazione</span></h3>
						{#each data.skills as s (s.id)}
							<label class="num">
								<span>{s.name}{#if statName(s.statId)} <span class="hint">{statName(s.statId)}</span>{/if}</span>
								<input type="number" name="skill_{s.id}" min="0" max={Math.min(s.maxRank, data.rules.creationSkillCap)} bind:value={alloc.skills[s.id]} />
							</label>
						{/each}
					</div>
				</div>
				<div>
					<button type="submit" disabled={statUsed > data.rules.creationStatPoints || skillUsed > data.rules.creationSkillPoints}>
						Conferma distribuzione
					</button>
				</div>
			</form>
		{:else}
			{#if !c.statsAllocated}
				<p class="muted">Il giocatore non ha ancora distribuito i punti iniziali.</p>
			{/if}
			<div class="grid">
				<div class="card">
					<h3>Caratteristiche</h3>
					<table>
						<tbody>
							{#each data.stats as s (s.id)}
								<tr>
									<td title={s.description}>{s.name}</td>
									<td class="value">{s.value}</td>
									{#if owner && c.statsAllocated && data.xp}
										<td class="act">
											{#if s.value < s.maxValue}
												<form method="post" action="?/migliora" use:enhance>
													<input type="hidden" name="target" value="stat:{s.id}" />
													<button class="link" type="submit" disabled={s.raiseCost > data.xp.available}>+1 ({s.raiseCost} PX)</button>
												</form>
											{:else}<span class="muted small">max</span>{/if}
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="card">
					<h3>Abilità</h3>
					<table>
						<tbody>
							{#each data.skills as s (s.id)}
								<tr>
									<td title={s.description}>
										{s.name}
										{#if statName(s.statId)}<span class="linked">{statName(s.statId)}</span>{/if}
									</td>
									<td class="value">{s.rank}</td>
									{#if owner && c.statsAllocated && data.xp}
										<td class="act">
											{#if s.rank < s.maxRank}
												<form method="post" action="?/migliora" use:enhance>
													<input type="hidden" name="target" value="skill:{s.id}" />
													<button class="link" type="submit" disabled={s.raiseCost > data.xp.available}>+1 ({s.raiseCost} PX)</button>
												</form>
											{:else}<span class="muted small">max</span>{/if}
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</section>

	{#if data.equipped.length}
		<section class="card equipment">
			<h2>Equipaggiamento</h2>
			<ul>
				{#each data.equipped as it (it.id)}
					<li>
						{#if it.imageUrl}<img src={it.imageUrl} alt="" />{/if}
						<div>
							<strong>{it.name}</strong> <span class="muted small">· {it.slot}</span>
							{#if it.description}<p class="small">{it.description}</p>{/if}
							{#if it.bonus}<p class="small bonus">In quest: {it.bonus}</p>{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.giocate.length}
		<section class="card giocate">
			<h2>Giocate pubbliche</h2>
			<ul class="history">
				{#each data.giocate as g (g.id)}
					<li>
						<a href="/giocate/{g.id}">{g.title}</a>
						<span class="muted small">{g.locationName} · {formatDate(g.fromAt)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.xp}
		<section class="card xp">
			<h2>Punti esperienza</h2>
			<div class="xp-numbers">
				<div><span class="big">{data.xp.available}</span><span class="muted">disponibili</span></div>
				<div><span class="big muted-num">{data.xp.total}</span><span class="muted">ricevuti</span></div>
				<div><span class="big muted-num">{data.xp.spent}</span><span class="muted">spesi</span></div>
			</div>
			{#if data.history.length}
				<h3>Storico</h3>
				<ul class="history">
					{#each data.history as h (h.id)}
						<li>
							<span class:neg={h.amount < 0} class="amount">{h.amount > 0 ? '+' : ''}{h.amount}</span>
							<span>{h.reason}</span>
							<span class="muted small">{formatDateTime(h.createdAt)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if data.viewer.canAward || data.viewer.isStaff || data.viewer.canGive || data.viewer.canConfiscate}
		<section class="staff">
			<button type="button" class="secondary" onclick={() => (showStaff = !showStaff)}>
				{showStaff ? 'Nascondi strumenti dello staff' : 'Strumenti dello staff'}
			</button>
			{#if showStaff}
				<div class="grid staff-tools">
					{#if data.viewer.canAward}
						<form method="post" action="?/assegnaPx" class="card stack" use:enhance>
							<h3>Assegna o togli PX</h3>
							<div>
								<label for="amount">Quantità <span class="hint">negativa per togliere</span></label>
								<input id="amount" name="amount" type="number" min="-1000" max="1000" required />
							</div>
							<div>
								<label for="reason">Motivo</label>
								<input id="reason" name="reason" type="text" maxlength="200" required />
							</div>
							<div><button type="submit">Conferma</button></div>
						</form>
					{/if}
					{#if data.viewer.canGive && data.giveable.length}
						<form method="post" action="?/consegna" class="card stack" use:enhance>
							<h3>Consegna un oggetto</h3>
							<select name="itemId" aria-label="Oggetto da consegnare">
								{#each data.giveable as i (i.id)}<option value={i.id}>{i.name}</option>{/each}
							</select>
							<label class="num"><span>Quantità</span><input type="number" name="quantity" min="1" max="100" value="1" /></label>
							<div><button type="submit">Consegna</button></div>
						</form>
					{/if}
					{#if data.viewer.canConfiscate}
						<div class="card stack">
							<h3>Inventario</h3>
							{#if data.staffInventory.length === 0}
								<p class="muted small">Vuoto.</p>
							{:else}
								<ul class="staff-inv">
									{#each data.staffInventory as i (i.id)}
										<li>
											<span>{i.name}{i.quantity > 1 ? ` ×${i.quantity}` : ''}{i.equipped ? ' (indossato)' : ''}</span>
											<form method="post" action="?/confisca" use:enhance>
												<input type="hidden" name="id" value={i.id} />
												<button type="submit" class="link">Togli</button>
											</form>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}
					{#if data.viewer.isStaff}
						<form method="post" action="?/correggi" class="card stack" use:enhance>
							<h3>Correggi i valori</h3>
							<p class="muted small">Imposta i valori direttamente, senza spendere PX.</p>
							{#each data.stats as s (s.id)}
								<label class="num"><span>{s.name}</span><input type="number" name="stat_{s.id}" min={s.minValue} max={s.maxValue} value={s.value} /></label>
							{/each}
							{#each data.skills as s (s.id)}
								<label class="num"><span>{s.name}</span><input type="number" name="skill_{s.id}" min="0" max={s.maxRank} value={s.rank} /></label>
							{/each}
							<div><button type="submit">Salva valori</button></div>
						</form>
						<form method="post" action="?/azzera" class="card stack" use:enhance>
							<h3>Azzera la distribuzione</h3>
							<p class="muted small">Cancella valori e PX spesi: il giocatore rifà la distribuzione iniziale. I PX ricevuti restano.</p>
							<div><button type="submit" class="danger">Azzera</button></div>
						</form>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</article>

<style>
	.equipment ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
		gap: 0.75rem;
	}
	.equipment li {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}
	.equipment img {
		width: 48px;
		height: 48px;
		object-fit: cover;
		border-radius: 6px;
		flex: 0 0 48px;
	}
	.equipment p {
		margin: 0.2rem 0 0;
	}
	.bonus {
		color: var(--c-positive);
	}
	.staff-inv {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.staff-inv li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.2rem 0;
	}
	.sheet {
		display: grid;
		gap: 1.5rem;
	}
	.top {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 640px) {
		.top {
			grid-template-columns: 1fr;
		}
		.portrait {
			max-width: 220px;
		}
	}
	.portrait img,
	.noportrait {
		width: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		display: block;
	}
	.noportrait {
		display: grid;
		place-items: center;
		font-family: var(--font-title);
		font-size: 4rem;
		color: var(--accent);
		background: var(--bg-raised);
	}
	.guilds {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.guilds a {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.75rem 0.25rem 0.25rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		text-decoration: none;
		color: var(--text);
		font-size: 0.9rem;
	}
	.guilds a:hover {
		border-color: var(--accent);
	}
	.guilds img {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		object-fit: cover;
	}
	.credit {
		margin-top: 0.4rem;
	}
	.label {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
	}
	.bio,
	.text {
		white-space: pre-line;
	}
	.bio {
		font-family: var(--font-title);
		font-style: italic;
		font-size: 1.1rem;
		color: var(--text-muted);
	}
	.small {
		font-size: 0.85rem;
	}
	.hint-on {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: -0.4rem;
	}
	.texts h2 {
		font-size: 1.25rem;
	}
	.numbers-head {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		flex-wrap: wrap;
	}
	table td {
		padding: 0.4rem 0.25rem;
	}
	.linked {
		display: block;
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.value {
		text-align: right;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--accent);
		width: 3rem;
	}
	.act {
		text-align: right;
		white-space: nowrap;
		width: 8rem;
	}
	.act form {
		display: inline;
	}
	.act button {
		font-size: 0.85rem;
	}
	.allocate {
		max-width: none;
	}
	.counters {
		display: flex;
		gap: 1.5rem;
		font-weight: 600;
	}
	.counters .over {
		color: var(--danger);
	}
	.num {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		font-weight: 400;
		margin-bottom: 0.4rem;
	}
	.num input {
		width: 80px;
	}
	.xp-numbers {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
	}
	.xp-numbers div {
		display: flex;
		flex-direction: column;
	}
	.big {
		font-family: var(--font-title);
		font-size: 2rem;
		color: var(--accent);
		line-height: 1.1;
	}
	.muted-num {
		color: var(--text-muted);
	}
	.history {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.history li {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		flex-wrap: wrap;
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--border);
	}
	.amount {
		font-weight: 700;
		color: var(--success);
		min-width: 3rem;
	}
	.amount.neg {
		color: var(--danger);
	}
	.staff-tools {
		margin-top: 1rem;
	}
</style>
