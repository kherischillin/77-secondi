<script lang="ts">
	/**
	 * Disegno della zona di un distretto sull'immagine della mappa madre.
	 * - Rettangolo: si tiene premuto e si trascina.
	 * - Forma libera: si clicca un vertice alla volta, poi "Chiudi la forma".
	 */
	import { areaFromPoints, boundingArea, rectPoints, type Area, type Point } from '#lib/districts.ts';

	let {
		imageUrl,
		alt,
		area = $bindable(null),
		points = $bindable(null),
		others = []
	}: {
		imageUrl: string;
		alt: string;
		area?: Area | null;
		points?: Point[] | null;
		others?: { name: string; area: Area; points?: Point[] | null }[];
	} = $props();

	let mode = $state<'rect' | 'poly'>('rect');
	$effect.pre(() => {
		// Una forma già salvata si modifica nella stessa modalità.
		if (points?.length) mode = 'poly';
	});
	let draft = $state<Point[]>([]);
	let box = $state<HTMLElement>();
	let start: { x: number; y: number } | null = null;

	const svg = (pts: Point[]) => pts.map((p) => p.join(',')).join(' ');
	const current = $derived(points?.length ? points : area ? rectPoints(area) : null);

	function point(e: PointerEvent) {
		const r = box!.getBoundingClientRect();
		return {
			x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)) * 100) / 100,
			y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) * 100) / 100
		};
	}
	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		const p = point(e);
		if (mode === 'poly') {
			draft = [...draft, [p.x, p.y]];
			return;
		}
		start = p;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!start || mode !== 'rect') return;
		const a = areaFromPoints(start, point(e));
		if (a) {
			area = a;
			points = null;
		}
	}
	function up(e: PointerEvent) {
		if (!start) return;
		move(e);
		start = null;
	}
	function closeShape() {
		if (draft.length < 3) return;
		points = draft;
		area = boundingArea(draft);
		draft = [];
	}
</script>

<div class="modes" role="group" aria-label="Come disegnare la zona">
	<label class="checkbox"><input type="radio" bind:group={mode} value="rect" onchange={() => (draft = [])} /><span>Rettangolo (trascina)</span></label>
	<label class="checkbox"><input type="radio" bind:group={mode} value="poly" /><span>Forma libera (clicca i vertici)</span></label>
</div>

<div class="picker" bind:this={box} onpointerdown={down} onpointermove={move} onpointerup={up} role="presentation">
	<img src={imageUrl} {alt} draggable="false" />
	<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
		{#each others as o (o.name)}
			<polygon class="other" points={svg(o.points?.length ? o.points : rectPoints(o.area))} vector-effect="non-scaling-stroke" />
		{/each}
		{#if current && !draft.length}
			<polygon class="mine" points={svg(current)} vector-effect="non-scaling-stroke" />
		{/if}
		{#if draft.length}
			<polyline class="draft" points={svg(draft)} vector-effect="non-scaling-stroke" />
		{/if}
	</svg>
	{#each draft as p, i (i)}
		<span class="vertex" style="left: {p[0]}%; top: {p[1]}%"></span>
	{/each}
	{#each others as o (o.name)}
		<span class="other-name" style="left: {o.area.x + o.area.w / 2}%; top: {o.area.y + o.area.h / 2}%">{o.name}</span>
	{/each}
</div>

{#if mode === 'poly'}
	<div class="tools">
		<span class="hint">{draft.length ? `${draft.length} vertici` : 'Clicca sull\'immagine lungo il confine del distretto.'}</span>
		<button type="button" class="secondary small" disabled={draft.length < 3} onclick={closeShape}>Chiudi la forma</button>
		<button type="button" class="link small" disabled={!draft.length} onclick={() => (draft = draft.slice(0, -1))}>Togli l'ultimo punto</button>
		<button type="button" class="link small" disabled={!draft.length} onclick={() => (draft = [])}>Ricomincia</button>
	</div>
{/if}

<style>
	.modes {
		display: flex;
		gap: 1.25rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}
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
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.mine {
		fill: color-mix(in srgb, var(--accent) 25%, transparent);
		stroke: var(--accent);
		stroke-width: 2;
	}
	.other {
		fill: color-mix(in srgb, var(--text-muted) 8%, transparent);
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.draft {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
	}
	.vertex {
		position: absolute;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		border: 1px solid var(--accent-text);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
	.other-name {
		position: absolute;
		transform: translate(-50%, -50%);
		font-size: 0.65rem;
		line-height: 1.2;
		color: var(--text-muted);
		background: var(--header-bg);
		padding: 1px 5px;
		border-radius: 999px;
		pointer-events: none;
		white-space: nowrap;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}
	.small {
		font-size: 0.85rem;
	}
</style>
