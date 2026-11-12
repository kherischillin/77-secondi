<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { MONEY_KIND_LABELS } from '#lib/economy.ts';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	const msg = (action: string) => (form && 'action' in form && form.action === action ? form : null);
	const fmt = (n: number) => n.toLocaleString('it-IT', { useGrouping: 'always' });
	const e = $derived(data.economy);

	// Gradi raggruppati per gilda.
	const guilds = $derived(
		[...new Map(data.ranks.map((r) => [r.guildId, { id: r.guildId, name: r.guildName, ranks: data.ranks.filter((x) => x.guildId === r.guildId) }])).values()]
	);
</script>

<svelte:head><title>Economia · Gestione</title></svelte:head>

<h1>Economia</h1>

<div class="grid">
	<section class="card">
		<h2>Valuta e regole</h2>
		{#if msg('impostazioni') && 'success' in form!}<div class="alert success">{form!.success}</div>{/if}
		<form method="post" action="?/impostazioni" class="stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<div>
				<label for="currencyName">Nome della valuta <span class="hint">al plurale: monete, eurodollari, crediti…</span></label>
				<input id="currencyName" name="currencyName" type="text" maxlength="30" required value={e.currencyName} />
				{#if errors.currencyName}<p class="field-error">{errors.currencyName}</p>{/if}
			</div>
			<div>
				<label for="startingMoney">Denaro iniziale <span class="hint">in tasca ai personaggi nuovi</span></label>
				<input id="startingMoney" name="startingMoney" type="number" min="0" value={e.startingMoney} />
			</div>
			<div>
				<label for="sellbackPercent">Rivendita al mercato <span class="hint">% del prezzo restituita</span></label>
				<input id="sellbackPercent" name="sellbackPercent" type="number" min="0" max="100" value={e.sellbackPercent} />
			</div>
			<div>
				<label for="salaryIntervalHours">Stipendio ogni <span class="hint">ore (24 = una volta al giorno)</span></label>
				<input id="salaryIntervalHours" name="salaryIntervalHours" type="number" min="1" max="720" value={e.salaryIntervalHours} />
			</div>
			<div><button type="submit">Salva</button></div>
		</form>
	</section>

	<section class="card">
		<h2>Correggi il denaro di un personaggio</h2>
		<p class="muted small">Premi, multe, rimborsi. Importo negativo per togliere. Resta tutto nei movimenti del personaggio e nel registro.</p>
		{#if msg('correggi') && 'success' in form!}<div class="alert success">{form!.success}</div>{/if}
		<form method="post" action="?/correggi" class="stack" use:enhance>
			<div>
				<label for="to">Personaggio</label>
				<input id="to" name="to" type="text" maxlength="80" required />
				{#if errors.to}<p class="field-error">{errors.to}</p>{/if}
			</div>
			<div class="two">
				<div>
					<label for="account">Dove</label>
					<select id="account" name="account"><option value="cash">Contanti</option><option value="bank">Conto in banca</option></select>
				</div>
				<div>
					<label for="adj">Importo</label>
					<input id="adj" name="amount" type="number" required />
					{#if errors.amount}<p class="field-error">{errors.amount}</p>{/if}
				</div>
			</div>
			<div>
				<label for="note">Motivo</label>
				<input id="note" name="note" type="text" maxlength="200" required />
				{#if errors.note}<p class="field-error">{errors.note}</p>{/if}
			</div>
			<div><button type="submit">Applica</button></div>
		</form>
	</section>
</div>

<section class="spaced">
	<h2>Stipendi dei gradi di gilda</h2>
	<p class="muted">I membri li ritirano in banca una volta ogni {e.salaryIntervalHours} ore. 0 = nessuno stipendio.</p>
	{#if msg('stipendio')}
		{#if 'success' in form!}<div class="alert success">{form!.success}</div>{/if}
		{#if 'error' in form!}<div class="alert error">{form!.error}</div>{/if}
	{/if}
	{#if guilds.length === 0}
		<p class="muted">Nessuna gilda.</p>
	{:else}
		<div class="guilds">
			{#each guilds as g (g.id)}
				<div class="card">
					<h3>{g.name}</h3>
					{#each g.ranks as r (r.rankId)}
						<form method="post" action="?/stipendio" class="rank" use:enhance={() => async ({ update }) => update({ reset: false })}>
							<input type="hidden" name="rankId" value={r.rankId} />
							<label for="salary-{r.rankId}">{r.rankName}</label>
							<input id="salary-{r.rankId}" name="salary" type="number" min="0" value={r.salary} />
							<button type="submit" class="secondary">Salva</button>
						</form>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</section>

<section class="spaced">
	<h2>Consulta un personaggio</h2>
	<form method="get" class="lookup">
		<input name="pg" type="text" placeholder="Nome del personaggio" value={data.lookup?.name ?? ''} aria-label="Nome del personaggio" />
		<button type="submit" class="secondary">Cerca</button>
	</form>
	{#if data.lookup && !data.lookup.found}
		<p class="muted">Nessun personaggio si chiama "{data.lookup.name}".</p>
	{:else if data.lookup?.found}
		{@const l = data.lookup}
		<p><strong>{l.name}</strong>: {fmt(l.money)} in tasca · {fmt(l.bank)} in banca ({e.currencyName})</p>
		{#if l.history.length}
			<div class="table-wrap card">
				<table>
					<thead><tr><th>Quando</th><th>Operazione</th><th>Dove</th><th class="num">Importo</th></tr></thead>
					<tbody>
						{#each l.history as h (h.id)}
							<tr>
								<td class="muted">{formatDateTime(h.createdAt)}</td>
								<td>{MONEY_KIND_LABELS[h.kind] ?? h.kind}{#if h.counterparty}{' '}<span class="muted">· {h.counterparty}</span>{/if}{#if h.note}{' '}<span class="muted">· {h.note}</span>{/if}</td>
								<td class="muted">{h.account === 'cash' ? 'contanti' : 'conto'}</td>
								<td class="num">{h.amount > 0 ? '+' : '−'}{fmt(Math.abs(h.amount))}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</section>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
		gap: 1rem;
		align-items: start;
	}
	.grid h2 {
		margin-top: 0;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.spaced {
		margin-top: 2.5rem;
	}
	.guilds {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
		gap: 0.75rem;
	}
	.guilds h3 {
		margin: 0 0 0.5rem;
	}
	.rank {
		display: grid;
		grid-template-columns: 1fr 6.5rem auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.25rem 0;
	}
	.rank label {
		margin: 0;
		font-weight: 400;
	}
	.lookup {
		display: flex;
		gap: 0.5rem;
		max-width: 420px;
		margin-bottom: 1rem;
	}
	.lookup input {
		flex: 1;
		width: auto;
	}
	.num {
		text-align: right;
		white-space: nowrap;
	}
	.small {
		font-size: 0.88rem;
	}
</style>
