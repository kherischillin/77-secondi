<script lang="ts">
	import { jobIconShapes } from '#lib/job-icons.ts';

	/** Icona di un lavoro libero; `title` (il nome del lavoro) compare passando sopra con il mouse. */
	let { icon, title, size = 18 }: { icon: string | null | undefined; title?: string; size?: number } = $props();
	const shapes = $derived(jobIconShapes(icon));
</script>

<svg
	class="job-icon"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	role={title ? 'img' : undefined}
	aria-label={title}
	aria-hidden={title ? undefined : 'true'}
>
	{#if title}<title>{title}</title>{/if}
	{#each shapes as s, i (i)}
		{#if 'd' in s}
			<path d={s.d} />
		{:else if 'cx' in s}
			<circle cx={s.cx} cy={s.cy} r={s.r} />
		{:else}
			<rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx ?? 0} />
		{/if}
	{/each}
</svg>

<style>
	.job-icon {
		display: inline-block;
		vertical-align: -0.2em;
		flex-shrink: 0;
		color: var(--accent);
	}
</style>
