<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tiles = $derived([
		{ label: 'Account registrati', value: data.stats.users },
		{ label: 'Personaggi', value: data.stats.characters },
		{ label: 'Account con sessione aperta', value: data.stats.usersWithSessions },
		{ label: 'Nuovi account nelle ultime 24 ore', value: data.stats.newUsers }
	]);
</script>

<svelte:head><title>Gestione · {data.siteName}</title></svelte:head>

<h1>Panoramica</h1>

<div class="grid">
	{#each tiles as tile (tile.label)}
		<div class="card tile">
			<span class="value">{tile.value}</span>
			<span class="muted">{tile.label}</span>
		</div>
	{/each}
</div>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.value {
		font-family: var(--font-title);
		font-size: 2.2rem;
		color: var(--accent);
		line-height: 1;
	}
</style>
