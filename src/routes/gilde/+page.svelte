<script lang="ts">
	import type { PageProps } from './$types';
	import { JOIN_MODE_LABELS } from '#lib/social.ts';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Gilde · {data.siteName}</title></svelte:head>

<div class="head">
	<h1>Gilde</h1>
	{#if data.canManage}<a class="button secondary" href="/gestione/gilde">Gestisci le gilde</a>{/if}
</div>
<p class="muted intro">
	Gruppi organizzati del mondo di gioco: ognuno ha uno statuto, un simbolo e i suoi gradi.
</p>

{#if data.guilds.length === 0}
	<p class="muted">Non ci sono ancora gilde.</p>
{:else}
	<div class="grid">
		{#each data.guilds as g (g.id)}
			<a class="card guild" href="/gilde/{g.id}">
				<div class="symbol">
					{#if g.symbolUrl}<img src={g.symbolUrl} alt="" />{:else}<span>{g.name.slice(0, 1)}</span>{/if}
				</div>
				<div>
					<h2>{g.name}</h2>
					{#if g.category}<p class="muted small">{g.category}</p>{/if}
					<p class="small">
						{g.members} membr{g.members === 1 ? 'o' : 'i'} · {JOIN_MODE_LABELS[g.joinMode]}
						{#if data.mine.includes(g.id)}<span class="badge accent">la tua gilda</span>{/if}
					</p>
				</div>
			</a>
		{/each}
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
		max-width: 70ch;
	}
	.guild {
		display: flex;
		gap: 1rem;
		align-items: center;
		color: inherit;
		text-decoration: none;
	}
	.guild:hover {
		border-color: var(--accent);
	}
	.symbol {
		flex: 0 0 64px;
		height: 64px;
		border-radius: 50%;
		overflow: hidden;
		border: 1px solid var(--border);
		display: grid;
		place-items: center;
		background: var(--bg-sunken);
		font-family: var(--font-title);
		font-size: 1.8rem;
		color: var(--accent);
	}
	.symbol img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	h2 {
		font-size: 1.2rem;
		margin: 0;
	}
	.small {
		font-size: 0.85rem;
		margin: 0.2rem 0 0;
	}
</style>
