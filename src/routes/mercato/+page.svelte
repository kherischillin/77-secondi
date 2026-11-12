<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import EconomyNav from '#lib/components/EconomyNav.svelte';
	import JobIcon from '#lib/components/JobIcon.svelte';

	let { data, form }: PageProps = $props();
	const fmt = (n: number) => `${n.toLocaleString('it-IT', { useGrouping: 'always' })} ${data.currency}`;
	const count = (n: number) => (n === 0 ? 'niente in vendita' : n === 1 ? '1 articolo' : `${n} articoli`);
</script>

<svelte:head><title>Mercato · {data.siteName}</title></svelte:head>

<h1>Mercato</h1>
<EconomyNav cash={data.purse.money} bank={data.purse.bank} currency={data.currency} />

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<p class="muted intro">Scegli un negozio. Si paga in contanti: se servono, prelevali in <a href="/banca">banca</a>.</p>

{#if data.shops.length === 0 && data.others === 0}
	<p class="muted">Al momento il mercato è chiuso.</p>
{:else}
	<ul class="shops">
		{#each data.shops as s (s.id)}
			<li>
				<a class="card shop" href="/mercato/{s.id}">
					<span class="icon"><JobIcon icon={s.icon} size={28} /></span>
					<span class="text">
						<strong class="name">{s.name}</strong>
						{#if s.tagline}<span class="tagline">{s.tagline}</span>{/if}
						{#if s.description}<span class="desc">{s.description}</span>{/if}
						<span class="count muted">{count(s.wares)}</span>
					</span>
				</a>
			</li>
		{/each}
		{#if data.others > 0}
			<li>
				<a class="card shop" href="/mercato/varie">
					<span class="icon"><JobIcon icon="stall" size={28} /></span>
					<span class="text">
						<strong class="name">Altri articoli</strong>
						<span class="tagline">Merce varia</span>
						<span class="count muted">{count(data.others)}</span>
					</span>
				</a>
			</li>
		{/if}
	</ul>
{/if}

<section class="sell card">
	<h2>Banco dell'usato</h2>
	{#if data.sellable.length === 0}
		<p class="muted">Non hai oggetti da vendere (quelli indossati vanno prima tolti).</p>
	{:else}
		<p class="muted">Qui si rivende quello che hai, al {data.sellbackPercent}% del prezzo.</p>
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
		margin-top: 0;
	}
	.shops {
		list-style: none;
		padding: 0;
		margin: 0 0 2rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
		gap: 0.75rem;
	}
	.shops li {
		display: flex;
	}
	.shop {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
		width: 100%;
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.15s;
	}
	.shop:hover,
	.shop:focus-visible {
		border-color: var(--accent);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		flex-shrink: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-sunken);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.name {
		font-family: var(--font-title);
		font-size: 1.15rem;
		color: var(--accent);
	}
	.tagline {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
	.desc {
		font-size: 0.92rem;
		margin-top: 0.2rem;
	}
	.count {
		font-size: 0.82rem;
		margin-top: 0.2rem;
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
	.buy {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.num {
		width: 4.5rem;
	}
</style>
