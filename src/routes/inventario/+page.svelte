<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import EconomyNav from '#lib/components/EconomyNav.svelte';
	import { describeBonuses, SLOT_LABELS, isSlot } from '#lib/economy.ts';

	let { data, form }: PageProps = $props();
	let giving = $state<number | null>(null);

	const equipped = $derived(data.items.filter((i) => i.equipped));
	const bag = $derived(data.items.filter((i) => !i.equipped));
	const bonusText = (b: (typeof data.items)[number]['item']['bonuses']) => describeBonuses(b, data.names.stats, data.names.skills);
	const slotLabel = (s: string) => (isSlot(s) ? SLOT_LABELS[s] : s);
</script>

<svelte:head><title>Inventario · {data.siteName}</title></svelte:head>

<h1>Inventario di {data.me.name}</h1>
<EconomyNav cash={data.purse.money} bank={data.purse.bank} currency={data.currency} />

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

{#snippet itemCard(entry: (typeof data.items)[number])}
	{@const it = entry.item}
	<li class="item card">
		{#if it.imageUrl}<img src={it.imageUrl} alt="" />{:else}<span class="ph" aria-hidden="true">{it.name.slice(0, 1)}</span>{/if}
		<div class="info">
			<p class="name">
				{it.name}{#if entry.quantity > 1}<span class="qty">×{entry.quantity}</span>{/if}
			</p>
			<p class="meta muted">
				{#if it.category}{it.category} · {/if}{slotLabel(it.slot)}{#if it.consumable} · consumabile{/if}
			</p>
			{#if it.description}<p class="desc">{it.description}</p>{/if}
			{#if it.bonuses.length}<p class="bonus" title="Si sommano alle prove in quest quando l'oggetto è indossato">In quest: {bonusText(it.bonuses)}</p>{/if}

			<div class="actions">
				{#if it.slot !== 'none'}
					<form method="post" action={entry.equipped ? '?/togli' : '?/indossa'} use:enhance>
						<input type="hidden" name="id" value={entry.id} />
						<button type="submit" class={entry.equipped ? 'secondary' : ''}>{entry.equipped ? 'Togli' : 'Indossa'}</button>
					</form>
				{/if}
				{#if !entry.equipped}
					<button type="button" class="link" onclick={() => (giving = giving === entry.id ? null : entry.id)}>{giving === entry.id ? 'Annulla' : 'Cedi a…'}</button>
				{/if}
			</div>
			{#if giving === entry.id}
				<form
					method="post"
					action="?/cedi"
					class="give"
					use:enhance={() => async ({ result, update }) => {
						await update();
						if (result.type === 'success') giving = null;
					}}
				>
					<input type="hidden" name="id" value={entry.id} />
					<input name="to" type="text" placeholder="Nome del personaggio" required aria-label="A chi cedere l'oggetto" />
					{#if entry.quantity > 1}
						<input name="quantity" type="number" min="1" max={entry.quantity} value="1" aria-label="Quantità" class="num" />
					{/if}
					<button type="submit">Cedi</button>
				</form>
				<p class="hint">Lo scambio va giocato anche in chat: qui si sposta solo l'oggetto.</p>
			{/if}
		</div>
	</li>
{/snippet}

<section>
	<h2>Indossati</h2>
	{#if equipped.length === 0}
		<p class="muted">Non indossi nulla. Gli oggetti indossati si vedono nella tua scheda e i loro bonus contano nelle prove in quest.</p>
	{:else}
		<ul class="items">
			{#each equipped as entry (entry.id)}{@render itemCard(entry)}{/each}
		</ul>
	{/if}
</section>

<section>
	<h2>Nello zaino</h2>
	{#if bag.length === 0}
		<p class="muted">Lo zaino è vuoto. Puoi comprare oggetti al <a href="/mercato">mercato</a>.</p>
	{:else}
		<ul class="items">
			{#each bag as entry (entry.id)}{@render itemCard(entry)}{/each}
		</ul>
	{/if}
</section>

<style>
	section {
		margin-bottom: 2rem;
	}
	.items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 0.75rem;
	}
	.item {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
		padding: 0.9rem;
	}
	.item img,
	.ph {
		width: 64px;
		height: 64px;
		flex: 0 0 64px;
		border-radius: 6px;
		object-fit: cover;
		background: var(--bg-sunken);
	}
	.ph {
		display: grid;
		place-items: center;
		font-family: var(--font-title);
		font-size: 1.6rem;
		color: var(--accent);
	}
	.info {
		flex: 1;
		min-width: 0;
	}
	.info p {
		margin: 0;
	}
	.name {
		font-weight: 700;
	}
	.qty {
		margin-left: 0.4rem;
		color: var(--accent);
		font-weight: 600;
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
	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-top: 0.6rem;
	}
	.give {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}
	.give input[name='to'] {
		flex: 1 1 160px;
		width: auto;
	}
	.num {
		width: 5rem;
	}
	.hint {
		margin: 0.3rem 0 0 !important;
	}
</style>
