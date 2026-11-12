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

	function measure() {
		const d = frame?.contentDocument;
		if (!d?.body) return;
		const next = Math.min(MAX_HEIGHT, Math.ceil(Math.max(d.body.scrollHeight, d.documentElement.offsetHeight)));
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
