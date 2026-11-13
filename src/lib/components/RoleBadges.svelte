<script lang="ts">
	import JobIcon from './JobIcon.svelte';
	import type { RoleBadge } from '#lib/role-badges.ts';

	/** Icone di lavoro e gilde accanto a un nome; quelle delle gilde sono collegamenti alla pagina della gilda. */
	let { badges, size = 16 }: { badges: RoleBadge[]; size?: number } = $props();
</script>

{#each badges as b (b.title)}
	{#if b.href}
		<a class="badge-link" href={b.href} title={b.title} aria-label="Gilda: {b.title}"><JobIcon icon={b.icon} title={b.title} {size} /></a>
	{:else}
		<JobIcon icon={b.icon} title={b.title} {size} />
	{/if}
{/each}

<style>
	.badge-link {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		border-radius: 3px;
	}
	.badge-link:hover :global(.job-icon) {
		color: var(--accent-strong);
		filter: drop-shadow(0 0 4px var(--accent));
	}
</style>
