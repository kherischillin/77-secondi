<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import EconomyNav from '#lib/components/EconomyNav.svelte';
	import { describeBonuses, isSlot, SLOT_LABELS } from '#lib/economy.ts';

	let { data, form }: PageProps = $props();
	let category = $state('');

	const categories = $derived([...new Set(data.market.map((i) => i.category || 'Varie'))]);
	const shown = $derived(category ? data.market.filter((i) => (i.category || 'Varie') === category) : data.market);
	const fmt = (n: number) => `${n.toLocaleString('it-IT', { useGrouping: 'always' })} ${data.currency}`;
	const slotLabel = (s: string) => (isSlot(s) ? SLOT_LABELS[s] : s);
</script>

<svelte:head><title>Mercato · {data.siteName}</title></svelte:head>

<h1>Mercato</h1>
<EconomyNav cash={data.purse.money} bank={data.purse.bank} currency={data.currency} />

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<p class="muted intro">Si paga in contanti: se servono, prelevali in <a href="/banca">banca</a>.</p>

{#if categories.length > 1}
	<nav class="filters" aria-label="Categorie">
		<button type="button" class:active={category === ''} onclick={() => (category = '')}>Tutto</button>
		{#each categories as c (c)}
			<button type="button" class:active={category === c} onclick={() => (category = c)}>{c}</button>
		{/each}
	</nav>
{/if}

{#if data.market.length === 0}
	<p class="muted">Al momento il mercato non vende nulla.</p>
{:else}
	<ul class="wares">
		{#each shown as it (it.id)}
			{@const soldOut = it.stock === 0}
			<li class="card ware" class:soldout={soldOut}>
				{#if it.imageUrl}<img src={it.imageUrl} alt="" />{:else}<span class="ph" aria-hidden="true">{it.name.slice(0, 1)}</span>{/if}
				<div class="info">
					<p class="name">{it.name}</p>
					<p class="meta muted">
						{it.category || 'Varie'} · {slotLabel(it.slot)}{#if it.consumable} · consumabile{/if}
						{#if it.stock !== null} · {soldOut ? 'esaurito' : `disponibili: ${it.stock}`}{/if}
					</p>
					{#if it.description}<p class="desc">{it.description}</p>{/if}
					{#if it.bonuses.length}<p class="bonus">In quest: {describeBonuses(it.bonuses, data.names.stats, data.names.skills)}</p>{/if}
					<form method="post" action="?/compra" class="buy" use:enhance={() => async ({ update }) => update({ reset: false })}>
						<input type="hidden" name="itemId" value={it.id} />
						<span class="price">{fmt(it.price)}</span>
						{#if it.slot === 'none'}
							<input name="quantity" type="number" min="1" max={it.stock ?? 1000} value="1" class="num" aria-label="Quantità di {it.name}" />
						{/if}
						<button type="submit" disabled={soldOut || it.price > data.purse.money}>Compra</button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<section class="sell card">
	<h2>Vendi</h2>
	{#if data.sellable.length === 0}
		<p class="muted">Non hai oggetti da vendere (quelli indossati vanno prima tolti).</p>
	{:else}
		<p class="muted">Il mercato compra al {data.sellbackPercent}% del prezzo.</p>
		<ul class="sell-list">
			{#each data.sellable as s (s.id)}
				<li>
					<span>{s.name}{#if s.quantity > 1} <span class="muted">×{s.quantity}</span>{/if}</span>
					<form method="post" action="?/vendi" class="buy" use:enhance>
						<input type="hidden" name="id" value={s.id} />
						{#if s.quantity > 1}<input name="quantity" type="number" min="1" max={s.quantity} value="1" class="num" aria-label="Quantità di {s.name}" />{/if}
						<span class="muted">{fmt(s.unitPrice)} cad.</span>
						<button type="submit" class="secondary">Vendi</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.intro {
		margin-top: -0.75rem;
	}
	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.filters button {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-muted);
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		font-size: 0.9rem;
	}
	.filters button.active {
		border-color: var(--accent);
		color: var(--accent);
	}
	.wares {
		list-style: none;
		padding: 0;
		margin: 0 0 2rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 0.75rem;
	}
	.ware {
		display: flex;
		gap: 0.9rem;
		padding: 0.9rem;
	}
	.soldout {
		opacity: 0.6;
	}
	.ware img,
	.ph {
		width: 72px;
		height: 72px;
		flex: 0 0 72px;
		border-radius: 6px;
		object-fit: cover;
		background: var(--bg-sunken);
	}
	.ph {
		display: grid;
		place-items: center;
		font-family: var(--font-title);
		font-size: 1.7rem;
		color: var(--accent);
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.info p {
		margin: 0;
	}
	.name {
		font-weight: 700;
	}
	.meta {
		font-size: 0.85rem;
	}
	.desc {
		margin-top: 0.35rem !important;
		font-size: 0.92rem;
		white-space: pre-line;
	}
	.bonus {
		margin-top: 0.35rem !important;
		font-size: 0.85rem;
		color: #9fd3b8;
	}
	.buy {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: auto;
		padding-top: 0.6rem;
	}
	.price {
		font-weight: 700;
		color: var(--accent);
		flex-basis: 100%;
	}
	.ware .buy button {
		margin-left: auto;
	}
	.num {
		width: 4.5rem;
	}
	.sell h2 {
		margin-top: 0;
	}
	.sell-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.sell-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
	}
	.sell-list li:last-child {
		border-bottom: none;
	}
	.sell-list .buy {
		margin: 0;
		padding: 0;
	}
</style>
