<script lang="ts">
	import type { PageProps } from './$types';
	import { fullName } from '#lib/format.ts';
	import Avatar from '#lib/components/Avatar.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Presenti · {data.siteName}</title></svelte:head>

<h1>Presenti <span class="muted count">{data.total}</span></h1>

{#if data.total === 0}
	<p class="muted">Nessuno in gioco in questo momento.</p>
{:else}
	<div class="grid">
		{#each data.groups as g (g.title)}
			<section class="card">
				<h2>
					{#if g.href}<a href={g.href}>{g.title}</a>{:else}{g.title}{/if}
				</h2>
				<ul>
					{#each g.people as p (p.characterId)}
						<li><a href="/scheda/{p.characterId}"><Avatar src={p.avatarUrl} name={p.name} size={30} /> {fullName(p)}</a></li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}

<style>
	.count {
		font-size: 1.2rem;
		font-family: var(--font-body);
	}
	h2 {
		font-size: 1.15rem;
	}
	h2 a {
		text-decoration: none;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	li a {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
	}
</style>
