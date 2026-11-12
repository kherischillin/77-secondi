<script lang="ts">
	import type { PageProps } from './$types';
	import { formatMoney } from '#lib/economy.ts';

	let { data }: PageProps = $props();
	const time = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head><title>Stanze private</title></svelte:head>

<h1>Stanze private</h1>
<p class="muted">
	Luoghi che si prenotano per qualche ora: durante la prenotazione entrano solo chi l'ha fatta e i suoi invitati.
	Per prenotare apri la stanza e usa il pannello di prenotazione.
</p>

{#if data.rooms.length === 0}
	<p class="muted">Non ci sono stanze private, per ora.</p>
{:else}
	<ul class="rooms">
		{#each data.rooms as r (r.id)}
			<li class="card">
				<div class="head">
					<a href="/gioco/luogo/{r.id}"><strong>{r.name}</strong></a>
					{#if r.mine}
						<span class="badge accent">Prenotata da te o con te</span>
					{:else if r.busyUntil}
						<span class="badge">Occupata fino alle {time(r.busyUntil)}</span>
					{:else}
						<span class="badge free">Libera</span>
					{/if}
				</div>
				<p class="muted small">{r.mapName} · {r.hourlyPrice > 0 ? `${formatMoney(r.hourlyPrice, data.currency)} l'ora` : 'gratis'} · al massimo {r.maxHours} {r.maxHours === 1 ? 'ora' : 'ore'}</p>
				{#if r.description}<p class="desc">{r.description}</p>{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.rooms {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
		gap: 1rem;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.small {
		font-size: 0.85rem;
		margin: 0.3rem 0;
	}
	.desc {
		margin: 0.4rem 0 0;
		white-space: pre-line;
		font-size: 0.92rem;
	}
	.free {
		color: var(--success);
	}
</style>
