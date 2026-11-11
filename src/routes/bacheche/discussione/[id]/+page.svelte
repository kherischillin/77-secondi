<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';
	import ReportButton from '#lib/components/ReportButton.svelte';

	let { data, form }: PageProps = $props();
	let editing = $state<number | null>(null);
	let confirmDelete = $state(false);
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<svelte:head><title>{data.thread.title} · {data.board.name}</title></svelte:head>

<p><a href="/bacheche/{data.board.id}">← {data.board.name}</a></p>
<h1>
	{data.thread.title}
	{#if data.thread.isPinned}<span class="badge accent">in evidenza</span>{/if}
	{#if data.thread.isLocked}<span class="badge">chiusa</span>{/if}
</h1>

{#if data.canModerate}
	<div class="mod-bar">
		<form method="post" action="?/fissa" use:enhance><button class="link" type="submit">{data.thread.isPinned ? 'Togli evidenza' : 'Metti in evidenza'}</button></form>
		<form method="post" action="?/blocca" use:enhance><button class="link" type="submit">{data.thread.isLocked ? 'Riapri' : 'Chiudi discussione'}</button></form>
		{#if !confirmDelete}
			<button class="link danger-link" type="button" onclick={() => (confirmDelete = true)}>Elimina discussione</button>
		{:else}
			<form method="post" action="?/elimina" use:enhance class="inline">
				<span>Eliminare la discussione e tutti i messaggi?</span>
				<button class="danger" type="submit">Sì, elimina</button>
				<button class="secondary" type="button" onclick={() => (confirmDelete = false)}>Annulla</button>
			</form>
		{/if}
	</div>
{/if}

{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<div class="posts">
	{#each data.posts as p (p.id)}
		<article class="post" class:hidden={p.hidden} class:character={!!p.characterId}>
			<header>
				{#if p.characterId}
					<a class="author" href="/scheda/{p.characterId}">{p.author}</a>
				{:else}
					<span class="author">{p.author}</span>
				{/if}
				<span class="muted small">{formatDateTime(p.createdAt)}{#if p.editedAt} · modificato{/if}</span>
				{#if p.hidden}<span class="badge danger">nascosto</span>{/if}
				<span class="tools">
					{#if !p.mine && !p.hidden}<ReportButton targetType="board_post" targetId={p.id} />{/if}
					{#if p.mine && !p.hidden && editing !== p.id}
						<button class="link" type="button" onclick={() => (editing = p.id)}>Modifica</button>
					{/if}
					{#if data.canModerate}
						<form method="post" action={p.hidden ? '?/ripristina' : '?/nascondi'} use:enhance>
							<input type="hidden" name="id" value={p.id} />
							<button class="link" type="submit">{p.hidden ? 'Ripristina' : 'Nascondi'}</button>
						</form>
					{/if}
				</span>
			</header>
			{#if editing === p.id}
				<form
					method="post"
					action="?/modifica"
					class="stack"
					use:enhance={() => async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') editing = null;
					}}
				>
					<input type="hidden" name="id" value={p.id} />
					<textarea name="body" rows="6" maxlength="20000" required>{p.body}</textarea>
					<div class="inline">
						<button type="submit">Salva</button>
						<button type="button" class="secondary" onclick={() => (editing = null)}>Annulla</button>
					</div>
				</form>
			{:else}
				<p class="body">{p.body}</p>
			{/if}
		</article>
	{/each}
</div>

{#if data.pages > 1}
	<nav class="pager" aria-label="Pagine">
		{#each Array.from({ length: data.pages }, (_, i) => i + 1) as n (n)}
			<a href="?pagina={n}" aria-current={n === data.page ? 'page' : undefined}>{n}</a>
		{/each}
	</nav>
{/if}

<div id="fondo"></div>
{#if data.access.canReply}
	<form method="post" action="?/rispondi" class="stack card reply" use:enhance={keep}>
		<label for="body">Rispondi come <strong>{data.postingAs}</strong></label>
		<textarea id="body" name="body" rows="6" maxlength="20000" required></textarea>
		<div><button type="submit">Pubblica risposta</button></div>
	</form>
{:else if data.access.writeBlock}
	<p class="muted">{data.access.writeBlock}</p>
{/if}

<style>
	h1 {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}
	h1 .badge {
		font-family: var(--font-body);
		margin: 0;
	}
	.mod-bar {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}
	.danger-link {
		color: var(--danger);
	}
	.inline {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.posts {
		display: grid;
		gap: 0.75rem;
	}
	.post {
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.8rem 1rem;
	}
	.post.character {
		border-left: 3px solid var(--accent);
	}
	.post.hidden {
		opacity: 0.55;
	}
	header {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.author {
		font-weight: 700;
		color: var(--accent);
		text-decoration: none;
	}
	.tools {
		margin-left: auto;
		display: flex;
		gap: 0.75rem;
		font-size: 0.85rem;
	}
	.tools form {
		display: inline;
	}
	.body {
		margin: 0.5rem 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.small {
		font-size: 0.82rem;
	}
	.pager {
		display: flex;
		gap: 0.5rem;
		margin: 1rem 0;
	}
	.pager a {
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		text-decoration: none;
	}
	.pager a[aria-current='page'] {
		background: var(--accent);
		color: var(--accent-text);
	}
	.reply {
		margin-top: 1.5rem;
		max-width: none;
	}
</style>
