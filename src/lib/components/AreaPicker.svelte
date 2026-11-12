<script lang="ts">
	/**
	 * Disegno dell'area di un distretto sull'immagine della mappa madre:
	 * si tiene premuto e si trascina per tracciare il rettangolo.
	 */
	import { areaFromPoints, type Area } from '#lib/districts.ts';

	let { imageUrl, alt, area = $bindable(null), others = [] }: { imageUrl: string; alt: string; area?: Area | null; others?: { name: string; area: Area }[] } = $props();

	let box = $state<HTMLElement>();
	let start: { x: number; y: number } | null = null;

	function point(e: PointerEvent) {
		const r = box!.getBoundingClientRect();
		return {
			x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
			y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
		};
	}
	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		start = point(e);
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!start) return;
		const a = areaFromPoints(start, point(e));
		if (a) area = a;
	}
	function up(e: PointerEvent) {
		if (!start) return;
		move(e);
		start = null;
	}
</script>

<div class="picker" bind:this={box} onpointerdown={down} onpointermove={move} onpointerup={up} role="presentation">
	<img src={imageUrl} {alt} draggable="false" />
	{#each others as o (o.name)}
		<span class="other" style="left: {o.area.x}%; top: {o.area.y}%; width: {o.area.w}%; height: {o.area.h}%"><span>{o.name}</span></span>
	{/each}
	{#if area}
		<span class="area" style="left: {area.x}%; top: {area.y}%; width: {area.w}%; height: {area.h}%"></span>
	{/if}
</div>

<style>
	.picker {
		position: relative;
		line-height: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		cursor: crosshair;
		touch-action: none;
		user-select: none;
	}
	img {
		display: block;
		width: 100%;
		height: auto;
		pointer-events: none;
	}
	.area {
		position: absolute;
		border: 2px solid var(--accent);
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		box-shadow: 0 0 0 9999px color-mix(in srgb, var(--bg) 45%, transparent);
		pointer-events: none;
	}
	.other {
		position: absolute;
		border: 1px dashed var(--text-muted);
		pointer-events: none;
		line-height: 1.2;
		display: grid;
		place-items: center;
	}
	.other span {
		font-size: 0.7rem;
		color: var(--text-muted);
		background: var(--header-bg);
		padding: 1px 6px;
		border-radius: 999px;
	}
</style>
