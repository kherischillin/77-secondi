<script lang="ts">
	/**
	 * Voce della barra in alto con un sottomenu.
	 * Si apre al clic (anche da tastiera) e si chiude cliccando fuori, con Esc o cambiando pagina.
	 * Su telefono il sottomenu si apre dentro il menu ☰, sotto la voce.
	 */
	import type { Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	let { label, children, current = false, id }: { label: Snippet; children: Snippet; current?: boolean; id: string } = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();

	afterNavigate(() => (open = false));

	function onDocumentClick(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}
	function onKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			open = false;
			root?.querySelector('button')?.focus();
		}
	}
</script>

<svelte:document onclick={onDocumentClick} onkeydown={onKeydown} />

<div class="menu" class:open bind:this={root}>
	<button type="button" class="trigger" class:current aria-expanded={open} aria-controls="menu-{id}" onclick={() => (open = !open)}>
		{@render label()}
		<span class="caret" aria-hidden="true"></span>
	</button>
	<div class="panel" id="menu-{id}" hidden={!open}>
		{@render children()}
	</div>
</div>

<style>
	.menu {
		position: relative;
	}
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: none;
		border: 0;
		padding: 0;
		min-height: 0;
		font: inherit;
		color: var(--text-muted);
		cursor: pointer;
	}
	.trigger:hover,
	.open .trigger,
	.trigger.current {
		color: var(--text);
	}
	.caret {
		width: 0.38rem;
		height: 0.38rem;
		border-right: 1.5px solid currentColor;
		border-bottom: 1.5px solid currentColor;
		transform: translateY(-25%) rotate(45deg);
		transition: transform 0.15s ease;
	}
	.open .caret {
		transform: translateY(15%) rotate(-135deg);
	}
	.panel {
		position: absolute;
		right: 0;
		top: calc(100% + 0.6rem);
		min-width: 210px;
		display: grid;
		padding: 0.35rem;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: 0 10px 30px var(--shadow);
		z-index: 30;
	}
	.panel[hidden] {
		display: none;
	}
	/* Voci del sottomenu: link, pulsanti di modulo e separatori passati dal layout. */
	.panel :global(a),
	.panel :global(button) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		padding: 0.45rem 0.7rem;
		border-radius: calc(var(--radius) - 3px);
		color: var(--text);
		text-decoration: none;
		background: none;
		border: 0;
		font: inherit;
		text-align: left;
		cursor: pointer;
		min-height: 0;
	}
	.panel :global(a:hover),
	.panel :global(button:hover),
	.panel :global(a[aria-current='page']) {
		background: var(--bg-sunken);
		color: var(--accent);
	}
	.panel :global(hr) {
		border: 0;
		border-top: 1px solid var(--border);
		margin: 0.3rem 0.4rem;
	}
	.panel :global(.group) {
		padding: 0.35rem 0.7rem 0.1rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}
	@media (max-width: 900px) {
		.panel {
			position: static;
			min-width: 0;
			margin-top: 0.4rem;
			box-shadow: none;
		}
	}
</style>
