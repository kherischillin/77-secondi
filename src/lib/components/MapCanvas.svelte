<script lang="ts">
	/**
	 * Immagine della mappa con i luoghi posizionati sopra (coordinate in percentuale,
	 * così la mappa resta corretta a qualsiasi dimensione dello schermo).
	 * Se viene passato `onpick`, cliccando sull'immagine si sceglie una posizione.
	 */
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

	let {
		imageUrl,
		alt,
		markers = [],
		onpick
	}: {
		imageUrl: string;
		alt: string;
		markers?: Marker[];
		onpick?: (x: number, y: number) => void;
	} = $props();

	const placed = $derived(markers.filter((m) => m.x !== null && m.y !== null));

	function pick(event: MouseEvent) {
		if (!onpick) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 100;
		const y = ((event.clientY - rect.top) / rect.height) * 100;
		onpick(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
	}
</script>

<div class="map" class:picking={!!onpick}>
	{#if onpick}
		<button type="button" class="surface" onclick={pick} aria-label="Clicca sulla mappa per scegliere la posizione">
			<img src={imageUrl} {alt} draggable="false" />
		</button>
	{:else}
		<img src={imageUrl} {alt} draggable="false" />
	{/if}

	{#each placed as m (m.id)}
		{#if m.href}
			<a
				class="marker"
				class:link={m.kind === 'map_link'}
				class:highlight={m.highlight}
				style="left: {m.x}%; top: {m.y}%"
				href={m.href}
			>
				<span class="dot" aria-hidden="true"></span>
				<span class="label">
					{m.name}{#if m.count}<span class="count">{m.count}</span>{/if}
				</span>
			</a>
		{:else}
			<span
				class="marker"
				class:link={m.kind === 'map_link'}
				class:highlight={m.highlight}
				style="left: {m.x}%; top: {m.y}%"
			>
				<span class="dot" aria-hidden="true"></span>
				<span class="label">{m.name}</span>
			</span>
		{/if}
	{/each}
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
	img {
		display: block;
		width: 100%;
		height: auto;
		user-select: none;
	}
	.surface {
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		background: none;
		border-radius: 0;
		cursor: crosshair;
	}
	.surface:hover {
		background: none;
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
	}
	.picking .marker {
		pointer-events: none;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--accent);
		border: 2px solid #1a1408;
		box-shadow: 0 0 0 3px rgba(212, 162, 76, 0.35);
	}
	.marker.link .dot {
		background: #8fb3d9;
		box-shadow: 0 0 0 3px rgba(143, 179, 217, 0.35);
	}
	.marker.highlight .dot {
		background: #f6e3b4;
		box-shadow: 0 0 0 5px rgba(246, 227, 180, 0.5);
	}
	.label {
		background: rgba(15, 13, 11, 0.85);
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
	a.marker:hover .count {
		background: var(--accent-text);
		color: var(--accent);
	}
</style>
