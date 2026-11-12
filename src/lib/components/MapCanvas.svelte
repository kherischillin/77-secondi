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
	import { zoomTransform, type Area } from '#lib/districts.ts';

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
	type District = { id: number; name: string; area: Area; href: string; count?: number };

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

<div class="map" class:picking={!!onpick} class:zooming={zooming !== null} bind:this={box} style:aspect-ratio={ratio ?? (crop ? '16 / 10' : undefined)}>
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
		{#each districts as d (d.id)}
			<a
				class="district"
				class:active={zooming === d.id}
				href={d.href}
				style="left: {d.area.x}%; top: {d.area.y}%; width: {d.area.w}%; height: {d.area.h}%"
				onclick={(e) => openDistrict(e, d)}
				aria-label="Distretto {d.name}"
			>
				<span class="district-label">
					{d.name}{#if d.count}<span class="count">{d.count}</span>{/if}
				</span>
			</a>
		{/each}
	</div>

	{#if onpick}
		<button type="button" class="surface" onclick={pick} aria-label="Clicca sulla mappa per scegliere la posizione"></button>
	{/if}

	{#if zooming === null}
		{#each placed as m (m.id)}
			{#if m.href}
				<a class="marker" class:link={m.kind === 'map_link'} class:highlight={m.highlight} style="left: {m.x}%; top: {m.y}%" href={m.href}>
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
	/* Aree dei distretti: si vedono passandoci sopra. */
	.district {
		position: absolute;
		display: grid;
		place-items: center;
		border: 1px dashed color-mix(in srgb, var(--accent) 55%, transparent);
		background: color-mix(in srgb, var(--accent) 6%, transparent);
		text-decoration: none;
		line-height: 1.2;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
		z-index: 1;
	}
	.district:hover,
	.district:focus-visible,
	.district.active {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		border: 2px solid var(--accent);
	}
	.district-label {
		background: var(--header-bg);
		color: var(--text);
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 3px 10px;
		border-radius: 999px;
		border: 1px solid var(--border);
		white-space: nowrap;
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	.district:hover .district-label {
		background: var(--accent);
		color: var(--accent-text);
	}
	.zooming .district-label {
		opacity: 0;
		transition: opacity 0.2s ease;
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
	.picking .district {
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
	a.marker:hover .count,
	.district:hover .count {
		background: var(--accent-text);
		color: var(--accent);
	}
	@media (prefers-reduced-motion: reduce) {
		.stage {
			transition: none;
		}
	}
</style>
