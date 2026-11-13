<script lang="ts" module>
	/**
	 * Sfondo predefinito della pagina iniziale: uno skyline notturno disegnato qui (niente immagini
	 * esterne né diritti d'autore), con i colori del tema attivo. Gli edifici sono generati da un
	 * numero fisso, quindi il disegno è sempre lo stesso (uguale sul server e nel browser).
	 */
	const W = 1600;
	const H = 900;

	function rng(seed: number) {
		return () => {
			seed |= 0;
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	type Building = { x: number; y: number; w: number; h: number; windows: { x: number; y: number; on: 0 | 1 | 2 }[]; antenna: boolean; neon: boolean };

	function layer(seed: number, minH: number, maxH: number, minW: number, maxW: number, windowsEvery: number, density: number): Building[] {
		const r = rng(seed);
		const out: Building[] = [];
		let x = -40;
		while (x < W + 40) {
			const w = minW + r() * (maxW - minW);
			// Più alti verso i lati, un po' più bassi al centro (lascia respiro ai pannelli).
			const side = Math.abs(x + w / 2 - W / 2) / (W / 2);
			const h = minH + r() * (maxH - minH) * (0.55 + side * 0.6);
			const y = H - h;
			const windows: Building['windows'] = [];
			if (windowsEvery > 0) {
				for (let wy = y + 14; wy < H - 30; wy += windowsEvery) {
					for (let wx = x + 8; wx < x + w - 10; wx += windowsEvery * 0.8) {
						const v = r();
						if (v < density) windows.push({ x: wx, y: wy, on: v < density * 0.18 ? 2 : 1 });
					}
				}
			}
			out.push({ x, y, w, h, windows, antenna: r() < 0.3, neon: r() < 0.35 });
			x += w + 2 + r() * 10;
		}
		return out;
	}

	const FAR = layer(7, 260, 520, 30, 70, 0, 0);
	const MID = layer(23, 200, 430, 50, 110, 16, 0.22);
	const NEAR = layer(77, 110, 300, 80, 170, 22, 0.12);
	const RAIN = (() => {
		const r = rng(2081);
		return Array.from({ length: 90 }, () => ({ x: r() * (W + 300), y: r() * H, l: 18 + r() * 40, o: 0.12 + r() * 0.25 }));
	})();
</script>

<svg class="skyline" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
	<defs>
		<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--bg)" />
			<stop offset="0.6" stop-color="color-mix(in srgb, var(--accent-2) 14%, var(--bg))" />
			<stop offset="1" stop-color="color-mix(in srgb, var(--accent) 22%, var(--bg))" />
		</linearGradient>
		<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
			<stop offset="0" stop-color="var(--accent)" stop-opacity="0.55" />
			<stop offset="0.45" stop-color="var(--accent)" stop-opacity="0.14" />
			<stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
		</radialGradient>
		<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--accent-2)" stop-opacity="0" />
			<stop offset="1" stop-color="var(--accent-2)" stop-opacity="0.22" />
		</linearGradient>
	</defs>

	<rect width={W} height={H} fill="url(#sky)" />
	<circle cx={W * 0.5} cy={H * 0.62} r="420" fill="url(#glow)" />

	<g class="far">
		{#each FAR as b, i (i)}<rect x={b.x} y={b.y} width={b.w} height={b.h} />{/each}
	</g>
	<rect y={H * 0.45} width={W} height={H * 0.55} fill="url(#haze)" />

	<g class="mid">
		{#each MID as b, i (i)}
			<rect class="body" x={b.x} y={b.y} width={b.w} height={b.h} />
			{#each b.windows as w, j (j)}<rect class="win" class:hot={w.on === 2} x={w.x} y={w.y} width="5" height="7" />{/each}
		{/each}
	</g>

	<g class="near">
		{#each NEAR as b, i (i)}
			<rect class="body" x={b.x} y={b.y} width={b.w} height={b.h} />
			{#if b.antenna}<line class="antenna" x1={b.x + b.w * 0.7} y1={b.y} x2={b.x + b.w * 0.7} y2={b.y - 46} /><circle class="beacon" cx={b.x + b.w * 0.7} cy={b.y - 48} r="3" />{/if}
			{#if b.neon}<line class="neon" x1={b.x + 4} y1={b.y + 18} x2={b.x + b.w - 4} y2={b.y + 18} />{/if}
			{#each b.windows as w, j (j)}<rect class="win" class:hot={w.on === 2} x={w.x} y={w.y} width="7" height="9" />{/each}
		{/each}
	</g>

	<g class="rain">
		{#each RAIN as d, i (i)}<line x1={d.x} y1={d.y} x2={d.x - d.l * 0.35} y2={d.y + d.l} opacity={d.o} />{/each}
	</g>
</svg>

<style>
	.skyline {
		width: 100%;
		height: 100%;
		display: block;
	}
	.far rect {
		fill: color-mix(in srgb, var(--accent-2) 10%, var(--bg-sunken));
		opacity: 0.75;
	}
	.mid .body {
		fill: color-mix(in srgb, var(--accent-2) 6%, var(--bg-sunken));
	}
	.near .body {
		fill: color-mix(in srgb, black 35%, var(--bg));
	}
	.win {
		fill: color-mix(in srgb, var(--accent-2) 55%, transparent);
	}
	.win.hot {
		fill: var(--accent);
	}
	.antenna {
		stroke: color-mix(in srgb, var(--text-muted) 50%, transparent);
		stroke-width: 2;
	}
	.beacon {
		fill: var(--danger, #ff3b5c);
	}
	.neon {
		stroke: var(--accent);
		stroke-width: 3;
		filter: drop-shadow(0 0 6px var(--accent));
	}
	.rain line {
		stroke: var(--accent-2);
		stroke-width: 1;
	}
	.rain {
		animation: rain 1.4s linear infinite;
	}
	@keyframes rain {
		from {
			transform: translate(0, -60px);
		}
		to {
			transform: translate(-20px, 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rain {
			animation: none;
		}
	}
</style>
