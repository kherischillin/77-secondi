<script lang="ts">
	/**
	 * Immagine della mappa con i luoghi posizionati sopra (coordinate in percentuale,
	 * così la mappa resta corretta a qualsiasi dimensione dello schermo).
	 *
	 * - `crop`: mostra solo un'area dell'immagine, ingrandita (distretto senza immagine propria).
	 *   Le coordinate dei luoghi sono allora relative a quell'area.
	 * - `districts`: aree cliccabili; al clic la mappa zooma sull'area e poi si apre il distretto.
	 * - `onpick`: cliccando sull'immagine si sceglie una posizione (pannello di gestione).
	 */
	import { goto } from '$app/navigation';
	import { labelPoint, rectPoints, zoomTransform, type Area, type Point } from '#lib/districts.ts';

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
		markers = [],
		crop = null,
		districts = [],
		onpick
	}: {
		imageUrl: string;
		alt: string;
		markers?: Marker[];
		crop?: Area | null;
		districts?: District[];
		onpick?: (x: number, y: number) => void;
	} = $props();

	const placed = $derived(markers.filter((m) => m.x !== null && m.y !== null));
	// Con molti luoghi i nomi si sovrapporrebbero: compaiono passandoci sopra (restano quelli con persone dentro).
	const compact = $derived(placed.length > 8);

	// Forme dei distretti (poligoni in coordinate 0-100) e posizione delle etichette.
	const shapes = $derived(
		districts.map((d) => {
			const points = d.points && d.points.length >= 3 ? d.points : rectPoints(d.area);
			const [lx, ly] = labelPoint({ points, label: d.label });
			// Con una forma libera la mappa ha già i nomi disegnati: l'etichetta compare passandoci sopra.
			return { ...d, svg: points.map((p) => p.join(',')).join(' '), lx, ly, hoverOnly: !!d.points?.length };
		})
	);
	let hovered = $state<number | null>(null);

	let box = $state<HTMLElement>();
	let natural = $state<{ w: number; h: number } | null>(null);
	let zoom = $state<{ scale: number; tx: number; ty: number } | null>(null);
	let img = $state<HTMLImageElement>();

	// L'immagine può essere già pronta prima che la pagina diventi interattiva: si legge subito la misura.
	$effect(() => {
		if (img?.complete && img.naturalWidth) natural = { w: img.naturalWidth, h: img.naturalHeight };
	});
	// Cambiando mappa (es. tornando indietro dopo uno zoom) si riparte da capo.
	$effect(() => {
		void imageUrl;
		void crop;
		zoom = null;
		zooming = null;
	});
	let zooming = $state<number | null>(null);

	// Proporzioni del riquadro: tutta l'immagine, oppure solo l'area ritagliata.
	const ratio = $derived(natural ? (crop ? (crop.w * natural.w) / (crop.h * natural.h) : natural.w / natural.h) : null);

	function pick(event: MouseEvent) {
		if (!onpick || !box) return;
		const rect = box.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 100;
		const y = ((event.clientY - rect.top) / rect.height) * 100;
		onpick(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
	}

	function openDistrict(event: MouseEvent, d: District) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || !box) return;
		event.preventDefault();
		if (zooming !== null) return;
		zooming = d.id;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduce) {
			goto(d.href);
			return;
		}
		const r = box.getBoundingClientRect();
		zoom = zoomTransform(d.area, { width: r.width, height: r.height });
		setTimeout(() => goto(d.href), 750);
	}
</script>

<div class="map" class:compact class:picking={!!onpick} class:zooming={zooming !== null} bind:this={box} style:aspect-ratio={ratio ?? (crop ? '16 / 10' : undefined)}>
	<div
		class="stage"
		class:cropped={!!crop}
		style:width={crop ? `${(100 / crop.w) * 100}%` : undefined}
		style:left={crop ? `${(-crop.x / crop.w) * 100}%` : undefined}
		style:top={crop ? `${(-crop.y / crop.h) * 100}%` : undefined}
		style:transform={zoom ? `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})` : undefined}
	>
		<img
			bind:this={img}
			src={imageUrl}
			{alt}
			draggable="false"
			onload={(e) => {
				const img = e.currentTarget as HTMLImageElement;
				natural = { w: img.naturalWidth, h: img.naturalHeight };
			}}
		/>
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
						<polygon class="district" class:active={zooming === d.id || hovered === d.id} points={d.svg} vector-effect="non-scaling-stroke" />
					</a>
				{/each}
			</svg>
			{#each shapes as d (d.id)}
				{#if !d.hoverOnly || hovered === d.id || zooming === d.id || d.count}
					<span class="district-label" class:muted-label={d.hoverOnly && hovered !== d.id && zooming !== d.id} style="left: {d.lx}%; top: {d.ly}%">
						{#if !d.hoverOnly || hovered === d.id || zooming === d.id}{d.name}{/if}{#if d.count}<span class="count">{d.count}</span>{/if}
					</span>
				{/if}
			{/each}
		{/if}
	</div>

	{#if onpick}
		<button type="button" class="surface" onclick={pick} aria-label="Clicca sulla mappa per scegliere la posizione"></button>
	{/if}

	{#if zooming === null}
		{#each placed as m (m.id)}
			{#if m.href}
				<a class="marker" class:link={m.kind === 'map_link'} class:highlight={m.highlight} class:busy={!!m.count} style="left: {m.x}%; top: {m.y}%" href={m.href} title={m.name}>
					<span class="dot" aria-hidden="true"></span>
					<span class="label">
						{m.name}{#if m.count}<span class="count">{m.count}</span>{/if}
					</span>
				</a>
			{:else}
				<span class="marker" class:link={m.kind === 'map_link'} class:highlight={m.highlight} style="left: {m.x}%; top: {m.y}%">
					<span class="dot" aria-hidden="true"></span>
					<span class="label">{m.name}</span>
				</span>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.map {
		position: relative;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--bg-sunken);
		line-height: 0;
	}
	.stage {
		position: relative;
		transform-origin: 0 0;
		transition: transform 0.75s cubic-bezier(0.45, 0, 0.2, 1);
	}
	/* Ritaglio: l'immagine intera è più grande del riquadro e spostata sull'area. */
	.stage.cropped {
		position: absolute;
	}
	img {
		display: block;
		width: 100%;
		height: auto;
		user-select: none;
	}
	.surface {
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
	/* Distretti: poligoni sopra l'immagine, evidenziati passandoci sopra. */
	.district-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		overflow: visible;
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
			stroke 0.2s ease;
	}
	.district.active {
		fill: color-mix(in srgb, var(--accent) 22%, transparent);
		stroke: var(--accent);
		stroke-width: 2.5;
		stroke-dasharray: none;
	}
	/* Il riquadro di focus del browser verrebbe ingrandito dallo zoom: si evidenzia la forma (vedi .active). */
	.district-layer a,
	.district-layer a:focus,
	.district-layer a:focus-visible {
		outline: none;
	}
	.district-label {
		position: absolute;
		transform: translate(-50%, -50%);
		z-index: 2;
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
		line-height: 1.2;
	}
	/* Solo il numero dei presenti, senza nome (il nome è già disegnato sulla mappa). */
	.district-label.muted-label {
		padding: 0;
		border: 0;
		background: none;
	}
	.zooming .district-label {
		display: none;
	}
	.marker {
		position: absolute;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-decoration: none;
		line-height: 1.2;
		pointer-events: auto;
		z-index: 2;
	}
	.picking .marker,
	.picking .district-layer {
		pointer-events: none;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--accent);
		border: 2px solid var(--accent-text);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);
	}
	.marker.link .dot {
		background: var(--c-whisper-strong);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-whisper-strong) 35%, transparent);
	}
	.marker.highlight .dot {
		background: var(--focus);
		box-shadow: 0 0 0 5px color-mix(in srgb, var(--focus) 50%, transparent);
	}
	.label {
		background: var(--header-bg);
		color: var(--text);
		font-size: 0.8rem;
		padding: 2px 8px;
		border-radius: 999px;
		white-space: nowrap;
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	/* Molti luoghi: il nome compare passandoci sopra (o se c'è qualcuno dentro). */
	.compact .marker .label {
		position: absolute;
		top: calc(100% + 2px);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s ease;
	}
	.compact .marker:hover .label,
	.compact .marker:focus-visible .label,
	.compact .marker.busy .label,
	.compact .marker.highlight .label {
		opacity: 1;
	}
	.compact .marker:hover,
	.compact .marker:focus-visible {
		z-index: 4;
	}
	.compact .dot {
		width: 12px;
		height: 12px;
	}
	a.marker:hover .label,
	a.marker:focus-visible .label {
		background: var(--accent);
		color: var(--accent-text);
	}
	.count {
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 999px;
		padding: 0 6px;
		font-weight: 700;
		font-size: 0.75rem;
	}
	a.marker:hover .count {
		background: var(--accent-text);
		color: var(--accent);
	}
	@media (prefers-reduced-motion: reduce) {
		.stage {
			transition: none;
		}
	}
</style>
