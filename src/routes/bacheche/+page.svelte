<script lang="ts">
	import type { PageProps } from './$types';
	import BoardList from '#lib/components/BoardList.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Bacheche · {data.siteName}</title></svelte:head>

<div class="head">
	<h1>Bacheche</h1>
	{#if data.canManage}<a class="button secondary" href="/gestione/bacheche">Gestisci le bacheche</a>{/if}
</div>

{#if data.on.length}
	<h2>ON GAME <span class="muted sub">si scrive come personaggio</span></h2>
	<BoardList boards={data.on} />
{/if}

{#if data.guild.length}
	<h2>Le tue gilde <span class="muted sub">riservate ai membri</span></h2>
	<BoardList boards={data.guild} />
{/if}

{#if data.off.length}
	<h2>OFF GAME <span class="muted sub">si scrive come giocatore</span></h2>
	<BoardList boards={data.off} />
{/if}

{#if !data.on.length && !data.off.length && !data.guild.length}
	<p class="muted">Non ci sono ancora bacheche.</p>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	h2 {
		font-size: 1.3rem;
	}
	.sub {
		font-family: var(--font-body);
		font-size: 0.85rem;
		font-weight: 400;
		margin-left: 0.4rem;
	}
</style>
