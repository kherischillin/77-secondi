<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDate } from '#lib/format.ts';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{data.page.title} · {data.siteName}</title></svelte:head>

<article class="doc">
	<header>
		<h1>{data.page.title}</h1>
		<p class="muted small">
			Aggiornata il {formatDate(data.page.updatedAt)}
			{#if data.canEdit}· <a href="/gestione/pagine/{data.page.id}">Modifica</a>{/if}
		</p>
	</header>
	<!-- Il testo è già stato neutralizzato da renderMarkup: niente HTML scritto a mano. -->
	<div class="prose">{@html data.page.html}</div>
</article>

<style>
	.doc {
		max-width: 72ch;
	}
	.small {
		font-size: 0.85rem;
	}
	.prose :global(h2) {
		margin-top: 2rem;
	}
	.prose :global(h3) {
		margin-top: 1.5rem;
	}
	.prose :global(ul),
	.prose :global(ol) {
		padding-left: 1.4rem;
		margin: 0 0 1em;
	}
	.prose :global(li) {
		margin-bottom: 0.3rem;
	}
	.prose :global(blockquote) {
		margin: 0 0 1em;
		padding: 0.6rem 1rem;
		border-left: 3px solid var(--accent);
		background: var(--bg-raised);
		border-radius: 4px;
	}
	.prose :global(hr) {
		border: none;
		border-top: 1px solid var(--border);
		margin: 2rem 0;
	}
	.prose :global(code) {
		background: var(--bg-sunken);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}
</style>
