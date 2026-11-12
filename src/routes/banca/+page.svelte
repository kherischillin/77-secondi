<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import EconomyNav from '#lib/components/EconomyNav.svelte';
	import { MONEY_KIND_LABELS } from '#lib/economy.ts';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	const fmt = (n: number) => n.toLocaleString('it-IT', { useGrouping: 'always' });
	const readyCount = $derived(data.salaries.filter((s) => s.ready).length);
</script>

<svelte:head><title>Banca · {data.siteName}</title></svelte:head>

<h1>Banca</h1>
<EconomyNav cash={data.purse.money} bank={data.purse.bank} currency={data.currency} />

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<div class="grid">
	<section class="card stack">
		<h2>Contanti e conto</h2>
		<p class="muted">I contanti servono al mercato e per le stanze private; il conto è al sicuro e riceve stipendi e bonifici.</p>
		<form method="post" action="?/deposita" class="row" use:enhance>
			<label for="dep" class="visually-hidden">Importo da depositare</label>
			<input id="dep" name="amount" type="number" min="1" max={data.purse.money || 1} placeholder="Importo" required />
			<button type="submit" disabled={data.purse.money === 0}>Deposita</button>
		</form>
		<form method="post" action="?/preleva" class="row" use:enhance>
			<label for="wd" class="visually-hidden">Importo da prelevare</label>
			<input id="wd" name="amount" type="number" min="1" max={data.purse.bank || 1} placeholder="Importo" required />
			<button type="submit" class="secondary" disabled={data.purse.bank === 0}>Preleva</button>
		</form>
	</section>

	<section class="card stack">
		<h2>Bonifico</h2>
		<form method="post" action="?/bonifico" class="stack" use:enhance>
			<div>
				<label for="to">A chi</label>
				<input id="to" name="to" type="text" maxlength="80" placeholder="Nome del personaggio" required value={form && 'to' in form ? form.to : ''} />
			</div>
			<div>
				<label for="amount">Importo <span class="hint">dal tuo conto</span></label>
				<input id="amount" name="amount" type="number" min="1" required />
			</div>
			<div>
				<label for="note">Causale <span class="hint">facoltativa</span></label>
				<input id="note" name="note" type="text" maxlength="200" />
			</div>
			<div><button type="submit" disabled={data.purse.bank === 0}>Invia bonifico</button></div>
		</form>
	</section>

	<section class="card stack">
		<h2>Stipendi</h2>
		{#if data.salaries.length === 0}
			<p class="muted">Nessuno stipendio: si riceve con un grado di gilda pagato dallo staff.</p>
		{:else}
			<ul class="pay">
				{#each data.salaries as s (s.guildId)}
					<li>
						<span><strong>{s.guildName}</strong> <span class="muted">· {s.rankName}</span></span>
						<span>
							{fmt(s.salary)}
							{#if s.ready}<span class="badge accent">pronto</span>{:else if s.nextAt}<span class="muted small">dal {formatDateTime(s.nextAt)}</span>{/if}
						</span>
					</li>
				{/each}
			</ul>
			<form method="post" action="?/stipendio" use:enhance>
				<button type="submit" disabled={readyCount === 0}>Ritira lo stipendio</button>
			</form>
		{/if}
	</section>
</div>

<section class="history">
	<h2>Movimenti</h2>
	{#if data.history.length === 0}
		<p class="muted">Ancora nessun movimento.</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr><th>Quando</th><th>Operazione</th><th>Dove</th><th class="num">Importo</th></tr>
				</thead>
				<tbody>
					{#each data.history as h (h.id)}
						<tr>
							<td class="muted">{formatDateTime(h.createdAt)}</td>
							<td>
								{MONEY_KIND_LABELS[h.kind] ?? h.kind}{#if h.counterparty}{' '}<span class="muted">{h.kind === 'transfer_in' ? 'da' : 'a'} {h.counterparty}</span>{/if}
								{#if h.note}<span class="note">{h.note}</span>{/if}
							</td>
							<td class="muted">{h.account === 'cash' ? 'contanti' : 'conto'}</td>
							<td class="num" class:neg={h.amount < 0}>{h.amount > 0 ? '+' : '−'}{fmt(Math.abs(h.amount))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}
	.grid h2 {
		margin: 0;
	}
	.grid p {
		margin: 0;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	.row input {
		flex: 1;
		width: auto;
		min-width: 0;
	}
	.pay {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.pay li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--border);
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}
	th {
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.85rem;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		font-weight: 600;
		color: #9fd3b8;
	}
	.num.neg {
		color: #e39a8f;
	}
	th.num {
		color: var(--text-muted);
	}
	.note {
		display: block;
		font-size: 0.85rem;
		color: var(--text-muted);
		font-style: italic;
	}
	.small {
		font-size: 0.85rem;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
