<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import ItemForm from '#lib/components/ItemForm.svelte';
	import { describeBonuses, isSlot, SLOT_LABELS } from '#lib/economy.ts';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form?.errors ?? {});
	let creating = $state(false);
	$effect(() => {
		if (form?.errors) creating = true;
	});
	const empty = { name: '', description: '', category: '', slot: 'none', price: 0, forSale: true, stock: null, sellable: true, consumable: false, bonuses: [] };
</script>

<svelte:head><title>Oggetti · Gestione</title></svelte:head>

<div class="head">
	<h1>Oggetti e mercato</h1>
	<button type="button" onclick={() => (creating = !creating)}>{creating ? 'Annulla' : 'Nuovo oggetto'}</button>
</div>
<p class="muted intro">
	Il catalogo di tutto ciò che esiste nel gioco. Gli oggetti "in vendita" compaiono al mercato; gli altri si consegnano ai personaggi
	(premi, ritrovamenti) dalla pagina dell'oggetto o dalla scheda del personaggio.
</p>

{#if creating}
	<form method="post" enctype="multipart/form-data" class="stack card new" use:enhance>
		<h2>Nuovo oggetto</h2>
		<ItemForm values={empty} {errors} stats={data.names.stats} skills={data.names.skills} categories={data.categories} />
		<div><button type="submit">Crea oggetto</button></div>
	</form>
{/if}

{#if data.items.length === 0}
	<p class="muted">Nessun oggetto nel catalogo.</p>
{:else}
	<div class="table-wrap card">
		<table>
			<thead><tr><th>Oggetto</th><th>Categoria</th><th>Posizione</th><th class="num">Prezzo</th><th>Mercato</th></tr></thead>
			<tbody>
				{#each data.items as it (it.id)}
					<tr class:archived={it.archived}>
						<td>
							<a href="/gestione/oggetti/{it.id}">{it.name}</a>
							{#if it.archived}<span class="badge">archiviato</span>{/if}
							{#if it.bonuses.length}<span class="bonus">{describeBonuses(it.bonuses, data.names.stats, data.names.skills)}</span>{/if}
						</td>
						<td>{it.category || '—'}</td>
						<td>{isSlot(it.slot) ? SLOT_LABELS[it.slot] : it.slot}</td>
						<td class="num">{it.price.toLocaleString('it-IT', { useGrouping: 'always' })}</td>
						<td>{#if it.forSale && !it.archived}{it.stock === null ? 'sì' : `sì (${it.stock})`}{:else}<span class="muted">no</span>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.intro {
		max-width: 80ch;
	}
	.new {
		margin-bottom: 1.5rem;
	}
	.new h2 {
		margin: 0;
	}
	.archived td {
		opacity: 0.6;
	}
	.bonus {
		display: block;
		font-size: 0.8rem;
		color: #9fd3b8;
	}
	.num {
		text-align: right;
	}
</style>
