<script lang="ts">
	import type { PageProps } from './$types';
	import { fullName } from '#lib/format.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import RoleBadges from '#lib/components/RoleBadges.svelte';

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
						<li>
							{#if p.characterId !== data.me}
								<a class="mail" href="/missive/nuova?a={encodeURIComponent(fullName(p))}" title="Scrivi una missiva a {fullName(p)}" aria-label="Scrivi una missiva a {fullName(p)}">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<rect x="3" y="5" width="18" height="14" rx="2" />
										<path d="M3.5 6.5 12 13l8.5-6.5" />
									</svg>
								</a>
							{:else}
								<span class="mail-slot" aria-hidden="true"></span>
							{/if}
							<a class="who" href="/scheda/{p.characterId}"><Avatar src={p.avatarUrl} name={p.name} size={30} /><span>{fullName(p)}</span></a>
							<RoleBadges badges={p.badges} size={16} />
						</li>
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
	/* Una riga per personaggio: missiva · avatar · nome · lavoro, tutto centrato in verticale. */
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		min-width: 0;
	}
	.who span {
		line-height: 1.2;
	}
	.mail,
	.mail-slot {
		flex: 0 0 28px;
		width: 28px;
		height: 28px;
	}
	.mail {
		display: grid;
		place-items: center;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--accent);
	}
	.mail:hover,
	.mail:focus-visible {
		border-color: var(--accent);
		background: var(--bg-sunken);
	}
	li > :global(.job-icon) {
		vertical-align: middle;
	}
</style>
