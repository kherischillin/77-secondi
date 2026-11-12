<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import Avatar from '#lib/components/Avatar.svelte';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	let composing = $state(false);
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	$effect(() => {
		if (errors.title || errors.body) composing = true;
	});
</script>

<svelte:head><title>{data.board.name} · Bacheche</title></svelte:head>

<p><a href="/bacheche">← Bacheche</a></p>
<div class="head">
	<div>
		<span class="badge {data.board.section === 'on' ? 'accent' : ''}">{data.board.section === 'on' ? 'ON GAME' : 'OFF GAME'}</span>
		<h1>{data.board.name}</h1>
		{#if data.board.description}<p class="muted">{data.board.description}</p>{/if}
	</div>
	<div class="actions">
		{#if data.threads.some((t) => t.unread)}
			<form method="post" action="?/letto" use:enhance><button type="submit" class="secondary">Segna tutto come letto</button></form>
		{/if}
		{#if data.access.canStartThread}
			<button type="button" onclick={() => (composing = !composing)}>{composing ? 'Annulla' : 'Nuova discussione'}</button>
		{/if}
	</div>
</div>

{#if errors.form}<div class="alert error">{errors.form}</div>{/if}
{#if !data.access.canStartThread && data.access.writeBlock}
	<p class="note muted">{data.access.writeBlock}</p>
{:else if !data.access.canStartThread}
	<p class="note muted">In questa bacheca le nuove discussioni le apre lo staff; puoi rispondere a quelle esistenti.</p>
{/if}

{#if composing}
	<form method="post" action="?/nuova" class="stack card compose" use:enhance={() => async ({ update }) => update({ reset: false })}>
		<p class="muted small">Scrivi come <strong>{data.postingAs}</strong>.</p>
		<div>
			<label for="title">Titolo</label>
			<input id="title" name="title" type="text" maxlength="120" required value={form && 'values' in form ? form.values?.title : ''} />
			{#if errors.title}<p class="field-error">{errors.title}</p>{/if}
		</div>
		<div>
			<label for="body">Messaggio</label>
			<textarea id="body" name="body" rows="8" maxlength="20000" required>{form && 'values' in form ? form.values?.body : ''}</textarea>
			{#if errors.body}<p class="field-error">{errors.body}</p>{/if}
		</div>
		<div><button type="submit">Pubblica</button></div>
	</form>
{/if}

{#if data.threads.length === 0}
	<p class="muted">Ancora nessuna discussione.</p>
{:else}
	<ul class="threads">
		{#each data.threads as t (t.id)}
			<li class:unread={t.unread}>
				<a href="/bacheche/discussione/{t.id}">
					<Avatar src={t.authorAvatar} name={t.author} size={34} />
					<span class="thread-text">
					<span class="title">
						{#if t.isPinned}<span class="badge accent">in evidenza</span>{/if}
						{#if t.isLocked}<span class="badge">chiusa</span>{/if}
						{t.title}
						{#if t.unread}<span class="new">novità</span>{/if}
					</span>
					<span class="muted small">di {t.author} · {t.posts} messagg{t.posts === 1 ? 'io' : 'i'} · ultimo {formatDateTime(t.lastPostAt)}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<nav class="pager" aria-label="Pagine">
	{#if data.page > 1}<a href="?pagina={data.page - 1}">← Più recenti</a>{/if}
	{#if data.hasNext}<a href="?pagina={data.page + 1}">Meno recenti →</a>{/if}
</nav>

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0.4rem 0 0.2rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.note {
		font-size: 0.9rem;
	}
	.compose {
		max-width: none;
		margin: 1rem 0;
	}
	.small {
		font-size: 0.85rem;
	}
	.threads {
		list-style: none;
		padding: 0;
		margin: 1rem 0 0;
		display: grid;
		gap: 0.4rem;
	}
	.threads a {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.15rem 0.8rem;
		padding: 0.7rem 1rem;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--text);
	}
	.thread-text {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.threads a:hover {
		border-color: var(--accent);
	}
	.unread a {
		border-left: 3px solid var(--accent);
	}
	.title {
		font-weight: 600;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.badge {
		margin: 0;
	}
	.new {
		font-size: 0.72rem;
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 999px;
		padding: 0 0.5rem;
		font-weight: 700;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem;
	}
</style>
