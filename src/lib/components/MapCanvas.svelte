<script lang="ts">
	/**
	 * Immagine della mappa con i luoghi posizionati sopra (coordinate in percentuale,
	 * così la mappa resta corretta a qualsiasi dimensione dello schermo).
	 *
	 * Il riquadro ha sempre le proporzioni dell'immagine intera: la mappa principale e i suoi distretti
	 * occupano lo stesso spazio. Un distretto senza immagine propria (`crop`) è un'inquadratura ingrandita
	 * dell'immagine della madre, con i dintorni scuriti (`focus` = forma del distretto): è la stessa
	 * inquadratura a cui arriva lo zoom al clic, così il passaggio è continuo, senza salti.
	 *
	 * - `districts`: aree cliccabili; al clic la mappa zooma sull'area mentre il distretto si carica.
	 * - `onpick`: cliccando sull'immagine si sceglie una posizione (pannello di gestione).
	 * - `onhover`: il luogo sotto il mouse (per evidenziarlo anche nell'elenco accanto).
	 */
	import { goto, preloadData } from '$app/navigation';
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cropToImage, fitView, fromFrame, FULL_VIEW, imageToCrop, labelPoint, rectPoints, toFrame, type Area, type Point } from '#lib/districts.ts';
	import { placeLabels, type LabelSide } from '#lib/map-labels.ts';

	type Marker = {
		id: number;
		name: string;
		x: number | null;
		y: number | null;
		href?: string;
		kind?: 'chat' | 'map_link';
		highlight?: boolean;
		count?: number;
	};
	/** Distretto: rettangolo (`area`) ed eventuale forma libera (`points`), che diventa l'area cliccabile. */
	type District = { id: number; name: string; area: Area; points?: Point[] | null; label?: Point; href: string; count?: number };

	let {
		imageUrl,
		alt,
		size = null,
		markers = [],
		crop = null,
		focus = null,
		districts = [],
		onpick,
		onhover
	}: {
		imageUrl: string;
		alt: string;
		size?: { width: number; height: number } | null;
		markers?: Marker[];
		crop?: Area | null;
		focus?: Point[] | null;
		districts?: District[];
		onpick?: (x: number, y: number) => void;
		onhover?: (id: number | null) => void;
	} = $props();

	let box = $state<HTMLElement>();
	let boxW = $state(0);
	let boxH = $state(0);
	let measured = $state<{ w: number; h: number } | null>(null);
	let img = $state<HTMLImageElement>();
	// Le misure arrivano dal server: il riquadro ha subito la forma giusta (senza aspettare l'immagine).
	const dims = $derived(size ? { w: size.width, h: size.height } : measured);
	const ratio = $derived(dims ? dims.w / dims.h : 16 / 10);

	$effect(() => {
		if (img?.complete && img.naturalWidth) measured = { w: img.naturalWidth, h: img.naturalHeight };
	});

	// Zoom verso un distretto appena cliccato: la pagina del distretto userà la stessa inquadratura.
	let zoomTarget = $state<Area | null>(null);
	let zooming = $state<number | null>(null);
	$effect(() => {
		void imageUrl;
		void crop;
		zoomTarget = null;
		zooming = null;
	});
	const view = $derived(crop ? fitView(crop) : zoomTarget ? fitView(zoomTarget) : FULL_VIEW);

	// Forme dei distretti (poligoni in coordinate 0-100 dell'immagine) e posizione delle etichette.
	const shapes = $derived(
		districts.map((d) => {
			const points = d.points && d.points.length >= 3 ? d.points : rectPoints(d.area);
			const [lx, ly] = labelPoint({ points, label: d.label });
			// Con una forma libera la mappa ha già i nomi disegnati: l'etichetta compare passandoci sopra.
			return { ...d, points, svg: points.map((p) => p.join(',')).join(' '), lx, ly, hoverOnly: !!d.points?.length };
		})
	);
	let hovered = $state<number | null>(null);

	// Zona messa in risalto (il distretto aperto, o quello verso cui si sta zoomando): il resto si scurisce.
	const focusPoints = $derived.by(() => {
		if (crop) return focus && focus.length >= 3 ? focus : rectPoints(crop);
		const target = zooming !== null ? shapes.find((s) => s.id === zooming) : null;
		return target ? target.points : null;
	});
	const dimPath = $derived(focusPoints ? `M-1 -1H101V101H-1Z M${focusPoints.map((p) => p.join(' ')).join(' L')} Z` : null);

	// Luoghi: posizione nel riquadro (i luoghi di un distretto sono salvati rispetto al suo ritaglio).
	const placed = $derived(
		markers
			.filter((m) => m.x !== null && m.y !== null)
			.map((m) => {
				const [fx, fy] = toFrame(view, ...cropToImage(crop, m.x!, m.y!));
				return { ...m, fx, fy };
			})
			.filter((m) => m.fx >= -1 && m.fx <= 101 && m.fy >= -1 && m.fy <= 101)
	);
	const districtLabels = $derived(
		shapes.map((d) => {
			const [fx, fy] = toFrame(view, d.lx, d.ly);
			return { ...d, fx, fy };
		})
	);

	// Nomi dei luoghi sempre visibili, ciascuno sul lato del puntino dove copre meno gli altri.
	let sides = $state<Map<number, LabelSide | null>>(new Map());
	$effect(() => {
		const list = placed;
		const [w, h] = [boxW, boxH];
		if (!box || !w || zooming !== null) return;
		tick().then(() => {
			if (!box) return;
			const items = list.map((p) => {
				const el = box!.querySelector<HTMLElement>(`[data-label="${p.id}"]`);
				return { x: (p.fx / 100) * w, y: (p.fy / 100) * h, w: el?.offsetWidth ?? 80, h: el?.offsetHeight ?? 18, priority: p.count || p.highlight ? 1 : 0 };
			});
			const result = placeLabels(items, { width: w, height: h });
			sides = new Map(list.map((p, i) => [p.id, result[i]]));
		});
	});

	const overlayKey = $derived(`${imageUrl}|${crop ? [crop.x, crop.y, crop.w, crop.h].join(',') : ''}`);

	function pick(event: MouseEvent) {
		if (!onpick || !box) return;
		const rect = box.getBoundingClientRect();
		const [ix, iy] = fromFrame(view, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
		const p = imageToCrop(crop, ix, iy);
		if (p) onpick(Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10);
	}

	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

	async function openDistrict(event: MouseEvent, d: District) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || !box) return;
		event.preventDefault();
		if (zooming !== null) return;
		zooming = d.id;
		hovered = null;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			goto(d.href);
			return;
		}
		zoomTarget = d.area;
		// Mentre l'immagine si ingrandisce, la pagina del distretto si carica: all'arrivo l'inquadratura è già quella.
		await Promise.all([preloadData(d.href).catch(() => {}), wait(800)]);
		goto(d.href);
	}
</script>

<div
	class="map"
	class:picking={!!onpick}
	class:zooming={zooming !== null}
	class:focused={!!crop}
	bind:this={box}
	bind:clientWidth={boxW}
	bind:clientHeight={boxH}
	style:--ratio={ratio}
>
	{#key imageUrl}
		<div class="stage" in:fade={{ duration: 300 }} style:transform="translate({view.tx}%, {view.ty}%) scale({view.s})">
			<img
				bind:this={img}
				src={imageUrl}
				{alt}
				draggable="false"
				onload={(e) => {
					const el = e.currentTarget as HTMLImageElement;
					measured = { w: el.naturalWidth, h: el.naturalHeight };
				}}
			/>
			{#if dimPath}
				<svg class="dim-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
					<path class="dim" d={dimPath} fill-rule="evenodd" />
					<polygon class="focus-edge" points={focusPoints!.map((p) => p.join(',')).join(' ')} vector-effect="non-scaling-stroke" />
				</svg>
			{/if}
			{#if shapes.length}
				<svg class="district-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Distretti">
					{#each shapes as d (d.id)}
						<a
							href={d.href}
							aria-label="Distretto {d.name}"
							onclick={(e) => openDistrict(e, d)}
							onmouseenter={() => (hovered = d.id)}
							onmouseleave={() => (hovered = hovered === d.id ? null : hovered)}
							onfocus={() => (hovered = d.id)}
							onblur={() => (hovered = hovered === d.id ? null : hovered)}
						>
							<polygon class="district" class:active={zooming === d.id || (zooming === null && hovered === d.id)} points={d.svg} vector-effect="non-scaling-stroke" />
						</a>
					{/each}
				</svg>
			{/if}
		</div>
	{/key}

	{#if onpick}
		<button type="button" class="surface" onclick={pick} aria-label="Clicca sulla mappa per scegliere la posizione"></button>
	{/if}

	{#if zooming === null}
		{#key overlayKey}
			<div class="overlay" in:fade={{ duration: 250, delay: 120 }}>
				{#each districtLabels as d (d.id)}
					{#if !d.hoverOnly || hovered === d.id || d.count}
						<span class="district-label" class:muted-label={d.hoverOnly && hovered !== d.id} style="left: {d.fx}%; top: {d.fy}%">
							{#if !d.hoverOnly || hovered === d.id}{d.name}{/if}{#if d.count}<span class="count">{d.count}</span>{/if}
						</span>
					{/if}
				{/each}
				{#each placed as m (m.id)}
					<svelte:element
						this={m.href ? 'a' : 'span'}
						class="marker side-{sides.get(m.id) ?? 'right'}"
						class:tight={sides.get(m.id) === null}
						class:link={m.kind === 'map_link'}
						class:highlight={m.highlight}
						class:busy={!!m.count}
						style="left: {m.fx}%; top: {m.fy}%"
						href={m.href}
						title={m.name}
						role={m.href ? undefined : 'img'}
						aria-label={m.href ? undefined : m.name}
						onmouseenter={() => onhover?.(m.id)}
						onmouseleave={() => onhover?.(null)}
						onfocus={() => onhover?.(m.id)}
						onblur={() => onhover?.(null)}
					>
						<span class="dot" aria-hidden="true"></span>
						<span class="label" data-label={m.id}>
							{m.name}{#if m.count}<span class="count">{m.count}</span>{/if}
						</span>
					</svelte:element>
				{/each}
			</div>
		{/key}
	{/if}
</div>

<style>
	.map {
		position: relative;
		/* Stesse proporzioni dell'immagine intera; non più alta dello schermo. */
		aspect-ratio: var(--ratio);
		width: min(100%, calc(var(--map-max-height, 80vh) * var(--ratio)));
		margin-inline: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--bg-sunken);
		line-height: 0;
		isolation: isolate;
	}
	.stage {
		position: absolute;
		inset: 0;
		transform-origin: 0 0;
		transition: transform 0.8s cubic-bezier(0.65, 0, 0.25, 1);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		user-select: none;
	}
	.surface {
		box-shadow: none;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		border-radius: 0;
		cursor: crosshair;
		z-index: 3;
	}
	.surface:hover {
		background: none;
	}
	.dim-layer,
	.district-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.dim-layer {
		pointer-events: none;
		animation: dim-in 0.6s ease both;
	}
	.dim {
		fill: color-mix(in srgb, var(--bg) 62%, transparent);
	}
	.focus-edge {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
		opacity: 0.75;
		transition: opacity 0.4s ease;
	}
	/* Durante lo zoom il browser ingrandisce anche lo spessore delle linee: si mostrano solo a zoom finito. */
	.zooming .focus-edge {
		opacity: 0;
		transition: none;
	}
	@keyframes dim-in {
		from {
			opacity: 0;
		}
	}
	/* Distretti: poligoni sopra l'immagine, evidenziati passandoci sopra. */
	.district-layer {
		z-index: 1;
	}
	.district {
		fill: color-mix(in srgb, var(--accent) 4%, transparent);
		stroke: color-mix(in srgb, var(--accent) 45%, transparent);
		stroke-width: 1;
		stroke-dasharray: 4 3;
		pointer-events: all;
		cursor: pointer;
		transition:
			fill 0.2s ease,
			stroke 0.2s ease,
			opacity 0.4s ease;
	}
	.district.active {
		fill: color-mix(in srgb, var(--accent) 22%, transparent);
		stroke: var(--accent);
		stroke-width: 2.5;
		stroke-dasharray: none;
	}
	/* Durante lo zoom resta solo il bordo del distretto scelto (il resto è già scurito). */
	.zooming .district:not(.active) {
		opacity: 0;
	}
	.zooming .district.active {
		fill: transparent;
		stroke: transparent;
	}
	/* Il riquadro di focus del browser verrebbe ingrandito dallo zoom: si evidenzia la forma (vedi .active). */
	.district-layer a,
	.district-layer a:focus,
	.district-layer a:focus-visible {
		outline: none;
	}
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		line-height: 1.2;
	}
	.district-label {
		position: absolute;
		transform: translate(-50%, -50%);
		pointer-events: none;
		background: var(--header-bg);
		color: var(--text);
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 3px 10px;
		border-radius: 999px;
		border: 1px solid var(--accent);
		white-space: nowrap;
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	/* Solo il numero dei presenti, senza nome (il nome è già disegnato sulla mappa). */
	.district-label.muted-label {
		padding: 0;
		border: 0;
		background: none;
	}
	/* Luogo: un punto senza misura nel punto esatto; il puntino è centrato lì e il nome sta di lato. */
	.marker {
		position: absolute;
		width: 0;
		height: 0;
		text-decoration: none;
		pointer-events: auto;
		z-index: 1;
	}
	.marker:hover,
	.marker:focus-visible,
	.marker.highlight {
		z-index: 3;
	}
	.picking .marker,
	.picking .district-layer {
		pointer-events: none;
	}
	.dot {
		position: absolute;
		left: -6px;
		top: -6px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--accent);
		border: 2px solid var(--accent-text);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);
		transition: transform 0.15s ease;
	}
	.marker.link .dot {
		background: var(--c-whisper-strong);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-whisper-strong) 35%, transparent);
	}
	.marker.highlight .dot,
	.marker:hover .dot,
	.marker:focus-visible .dot {
		transform: scale(1.3);
	}
	.marker.highlight .dot {
		background: var(--focus);
		box-shadow: 0 0 0 5px color-mix(in srgb, var(--focus) 50%, transparent);
	}
	.label {
		position: absolute;
		background: color-mix(in srgb, var(--header-bg) 88%, transparent);
		color: var(--text);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		font-size: 0.72rem;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 999px;
		white-space: nowrap;
		display: inline-flex;
		gap: 5px;
		align-items: center;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}
	.side-right .label {
		left: 10px;
		top: 0;
		transform: translateY(-50%);
	}
	.side-left .label {
		right: 10px;
		top: 0;
		transform: translateY(-50%);
	}
	.side-below .label {
		top: 10px;
		left: 0;
		transform: translateX(-50%);
	}
	.side-above .label {
		bottom: 10px;
		left: 0;
		transform: translateX(-50%);
	}
	/* Nome che non ci sta: compare passandoci sopra (o evidenziandolo dall'elenco). */
	.marker.tight .label {
		opacity: 0;
		pointer-events: none;
	}
	.marker.tight:hover .label,
	.marker.tight:focus-visible .label,
	.marker.tight.highlight .label {
		opacity: 1;
	}
	.marker.busy .label {
		border-color: var(--accent);
	}
	a.marker:hover .label,
	a.marker:focus-visible .label,
	.marker.highlight .label {
		background: var(--accent);
		color: var(--accent-text);
		border-color: var(--accent);
	}
	.count {
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 999px;
		padding: 0 5px;
		font-weight: 700;
		font-size: 0.7rem;
	}
	a.marker:hover .count,
	.marker.highlight .count {
		background: var(--accent-text);
		color: var(--accent);
	}
	@media (prefers-reduced-motion: reduce) {
		.stage {
			transition: none;
		}
	}
</style>
