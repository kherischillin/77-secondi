<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<h1>Spazio Master</h1>
<nav class="tabs" aria-label="Strumenti dei Master">
	{#if data.masterCan.esiti}
		<a href="/master/esiti" aria-current={page.url.pathname.startsWith('/master/esiti') ? 'page' : undefined}>Esiti</a>
	{/if}
	{#if data.masterCan.giocate}
		<a href="/master/giocate" aria-current={page.url.pathname.startsWith('/master/giocate') ? 'page' : undefined}>Giocate da rivedere</a>
	{/if}
</nav>

{@render children()}

<style>
	.tabs {
		display: flex;
		gap: 1.25rem;
		margin: 0.25rem 0 1.25rem;
		border-bottom: 1px solid var(--border);
	}
	.tabs a {
		padding: 0.4rem 0;
		color: var(--text-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}
	.tabs a[aria-current='page'] {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}
</style>
