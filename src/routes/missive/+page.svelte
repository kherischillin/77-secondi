<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDateTime, fullName } from '#lib/format.ts';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Missive · {data.siteName}</title></svelte:head>

<div class="head">
	<h1>Missive di {fullName(data.me)}</h1>
	<a class="button" href="/missive/nuova">Scrivi una missiva</a>
</div>

<nav class="tabs" aria-label="Cartelle">
	<a href="/missive" aria-current={!data.archived ? 'page' : undefined}>In arrivo</a>
	<a href="/missive?archivio" aria-current={data.archived ? 'page' : undefined}>Archiviate</a>
</nav>

{#if data.threads.length === 0}
	<p class="muted">{data.archived ? 'Nessuna missiva archiviata.' : 'Nessuna missiva. Scrivi tu la prima!'}</p>
{:else}
	<ul class="threads">
		{#each data.threads as t (t.id)}
			<li class:unread={t.unread}>
				<a href="/missive/{t.id}">
					<span class="top">
						<span class="badge {t.onGame ? 'accent' : ''}">{t.onGame ? 'ON' : 'OFF'}</span>
						<strong class="subject">{t.subject}</strong>
						{#if t.unread}<span class="new">nuova</span>{/if}
						<span class="muted small when">{formatDateTime(t.lastMessageAt)}</span>
					</span>
					<span class="muted small">con {t.other ?? '—'}</span>
					<span class="preview">{t.preview}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.tabs {
		display: flex;
		gap: 1.25rem;
		margin: 0.5rem 0 1rem;
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
	.threads {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.threads a {
		display: grid;
		gap: 0.15rem;
		padding: 0.75rem 1rem;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}
	.threads a:hover {
		border-color: var(--accent);
	}
	.unread a {
		border-left: 3px solid var(--accent);
	}
	.top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.subject {
		font-weight: 600;
	}
	.unread .subject {
		color: var(--accent-strong);
	}
	.new {
		font-size: 0.75rem;
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 999px;
		padding: 0 0.5rem;
		font-weight: 700;
	}
	.when {
		margin-left: auto;
	}
	.preview {
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.small {
		font-size: 0.85rem;
	}
	.badge {
		margin: 0;
	}
</style>
