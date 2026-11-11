<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime, fullName } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	let composing = $state(false);
	const errors = $derived<Record<string, string>>(form?.errors ?? {});
	$effect(() => {
		if (form?.errors) composing = true;
	});
</script>

<svelte:head><title>Esiti · {data.siteName}</title></svelte:head>

<div class="head">
	<h1>Esiti di {fullName(data.me)}</h1>
	<button type="button" onclick={() => (composing = !composing)}>{composing ? 'Annulla' : 'Chiedi un esito'}</button>
</div>
<p class="muted intro">
	Per le azioni che il personaggio compie fuori dalla chat (un'indagine, un lavoro, un viaggio, una ricerca)
	chiedi ai Master di raccontarne l'esito. Un Master se ne occupa e ti risponde qui.
</p>

{#if composing}
	<form method="post" class="stack card compose" use:enhance={() => async ({ update }) => update({ reset: false })}>
		<div>
			<label for="title">Titolo</label>
			<input id="title" name="title" type="text" maxlength="120" required value={form?.values?.title ?? ''} placeholder="Es. Ricerche nella biblioteca del tempio" />
			{#if errors.title}<p class="field-error">{errors.title}</p>{/if}
		</div>
		<div>
			<label for="body">Cosa fa il personaggio <span class="hint">racconto ON game, in terza persona</span></label>
			<textarea id="body" name="body" rows="8" maxlength="10000" required>{form?.values?.body ?? ''}</textarea>
			{#if errors.body}<p class="field-error">{errors.body}</p>{/if}
		</div>
		<div>
			<label for="offNote">Note per il Master <span class="hint">OFF game, facoltative: cosa speri di ottenere, chiarimenti</span></label>
			<textarea id="offNote" name="offNote" rows="3" maxlength="3000">{form?.values?.offNote ?? ''}</textarea>
		</div>
		<div><button type="submit">Invia ai Master</button></div>
	</form>
{/if}

{#if data.esiti.length === 0}
	<p class="muted">Nessuna richiesta di esito.</p>
{:else}
	<ul class="list">
		{#each data.esiti as e (e.id)}
			<li class:unread={e.unread}>
				<a href="/esiti/{e.id}">
					<span class="title">
						{e.title}
						{#if e.unread}<span class="new">risposta</span>{/if}
						<span class="badge {e.status === 'open' ? 'accent' : ''}">{e.status === 'open' ? 'aperto' : 'chiuso'}</span>
					</span>
					<span class="muted small">
						{e.master ? `Master: ${e.master}` : 'In attesa di un Master'} · {formatDateTime(e.lastActivityAt)}
					</span>
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
	.intro {
		max-width: 75ch;
	}
	.compose {
		max-width: 820px;
		margin-bottom: 1.5rem;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.list a {
		display: grid;
		gap: 0.15rem;
		padding: 0.75rem 1rem;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}
	.list a:hover {
		border-color: var(--accent);
	}
	.unread a {
		border-left: 3px solid var(--accent);
	}
	.title {
		font-weight: 600;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
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
	.small {
		font-size: 0.85rem;
	}
</style>
