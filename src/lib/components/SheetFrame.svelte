<script lang="ts">
	/**
	 * Riquadro isolato per l'HTML/CSS della scheda.
	 * - `sandbox` senza `allow-scripts`: il browser non esegue nessuno script.
	 * - `allow-same-origin` serve solo alla pagina per misurare l'altezza del contenuto.
	 * - Il CSS del giocatore vive nel documento del riquadro: non tocca il resto del sito.
	 */
	import { onDestroy } from 'svelte';
	import { buildFrameDoc, FRAME_THEME_VARS } from '#lib/sheet-html.ts';

	let { html, title }: { html: string; title: string } = $props();

	const MAX_HEIGHT = 8000;
	let frame = $state<HTMLIFrameElement>();
	let height = $state(60);
	let observer: ResizeObserver | null = null;

	function themeOfPage() {
		const style = getComputedStyle(document.documentElement);
		const vars: Record<string, string> = {};
		for (const name of FRAME_THEME_VARS) vars[name] = style.getPropertyValue(name).trim();
		return { vars, colorScheme: style.colorScheme };
	}

	const doc = $derived(typeof document === 'undefined' ? '' : buildFrameDoc(html, themeOfPage()));

	/**
	 * Altezza del contenuto. Molti codici dei GDR mettono tutto in `position: absolute`,
	 * che non conta nell'altezza normale della pagina: si guarda anche dove finisce
	 * il più basso degli elementi.
	 */
	function measure() {
		const d = frame?.contentDocument;
		const w = frame?.contentWindow;
		if (!d?.body || !w) return;
		let bottom = Math.max(d.body.scrollHeight, d.body.offsetHeight);
		for (const el of d.body.querySelectorAll('*')) {
			const r = el.getBoundingClientRect();
			if (r.height > 0 && r.width > 0) bottom = Math.max(bottom, r.bottom + w.scrollY);
		}
		const next = Math.min(MAX_HEIGHT, Math.ceil(bottom));
		if (Math.abs(next - height) > 1) height = next;
	}

	function onload() {
		observer?.disconnect();
		const d = frame?.contentDocument;
		if (!d) return;
		measure();
		observer = new ResizeObserver(measure);
		observer.observe(d.body);
		// Le immagini e i caratteri arrivano dopo: si rimisura quando sono pronti.
		d.addEventListener('load', measure, true);
		// Linguette e animazioni in CSS cambiano le dimensioni: si rimisura alla fine.
		d.addEventListener('transitionend', measure, true);
		d.addEventListener('change', () => setTimeout(measure, 50), true);
		d.fonts?.ready.then(measure).catch(() => {});
	}

	onDestroy(() => observer?.disconnect());
</script>

{#if doc}
	<iframe
		bind:this={frame}
		{title}
		srcdoc={doc}
		sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
		referrerpolicy="no-referrer"
		scrolling={height >= MAX_HEIGHT ? 'yes' : 'no'}
		style:height="{height}px"
		{onload}
	></iframe>
{/if}

<style>
	iframe {
		display: block;
		width: 100%;
		border: 0;
		background: transparent;
	}
</style>
