<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import ChatLine from '#lib/components/ChatLine.svelte';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	const g = $derived(data.giocata);
	let confirmDelete = $state(false);
	let base = $state(10);
</script>

<svelte:head><title>{g.title} · Giocate</title></svelte:head>

<p><a href="/giocate">← Le mie giocate</a></p>
<div class="head">
	<div>
		<h1>{g.title}</h1>
		<p class="muted">
			{g.locationName} · dal {formatDateTime(g.fromAt)} al {formatDateTime(g.toAt)}
			{#if g.isPublic}<span class="badge">pubblica</span>{/if}
			{#if g.reviewedAt}<span class="badge accent">rivista</span>{:else if g.reviewRequestedAt}<span class="badge">inviata ai Master</span>{/if}
		</p>
	</div>
	<div class="tools">
		<a class="button secondary" href="/giocate/{g.id}/scarica">Scarica (HTML)</a>
		{#if data.can.togglePublic}
			<form method="post" action="?/pubblica" use:enhance><button type="submit" class="secondary">{g.isPublic ? 'Rendi privata' : 'Rendi pubblica'}</button></form>
		{/if}
		{#if data.can.requestReview}
			<form method="post" action="?/inviaMaster" use:enhance><button type="submit">Invia ai Master</button></form>
		{/if}
	</div>
</div>

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<section class="participants card">
	<strong>Partecipanti:</strong>
	{#each data.participants.players as p, i (p.id)}{i > 0 ? ', ' : ' '}<a href="/scheda/{p.id}">{p.name}</a>{/each}
	{#if data.participants.masters.length}
		· <strong>Master:</strong>
		{#each data.participants.masters as p, i (p.id)}{i > 0 ? ', ' : ' '}{p.name}{/each}
	{/if}
</section>

{#if g.reviewedAt && g.reviewNote}
	<div class="review-note"><strong>Nota del Master:</strong> {g.reviewNote}</div>
{/if}

<div class="log">
	{#each g.messages as m (m.id)}
		<ChatLine message={m} me={0} />
	{/each}
</div>

{#if data.can.review}
	<form method="post" action="?/rivedi" class="stack card review" use:enhance>
		<h2>Revisione del Master</h2>
		<div class="base">
			<label for="base">PX uguali per tutti i giocatori</label>
			<input id="base" type="number" min="0" max="1000" bind:value={base} />
		</div>
		<table>
			<tbody>
				{#each data.participants.players as p (p.id)}
					<tr>
						<td>{p.name}</td>
						<td>
							{#if p.mine}
								<span class="muted small">tuo personaggio: niente PX</span>
								<input type="hidden" name="px_{p.id}" value="0" />
							{:else}
								<input name="px_{p.id}" type="number" min="0" max="1000" value={base} aria-label="PX per {p.name}" />
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#each data.participants.masters as p (p.id)}
			<input type="hidden" name="px_{p.id}" value="0" />
		{/each}
		<div>
			<label for="note">Nota per i giocatori <span class="hint">facoltativa</span></label>
			<textarea id="note" name="note" rows="3" maxlength="2000"></textarea>
		</div>
		<div><button type="submit">Salva revisione</button></div>
	</form>
{/if}

{#if data.can.delete}
	<section class="danger-zone">
		{#if !confirmDelete}
			<button type="button" class="danger" onclick={() => (confirmDelete = true)}>Elimina giocata</button>
		{:else}
			<form method="post" action="?/elimina" class="tools" use:enhance>
				<span>Eliminare questa registrazione? I messaggi in chat restano.</span>
				<button type="submit" class="danger">Sì, elimina</button>
				<button type="button" class="secondary" onclick={() => (confirmDelete = false)}>Annulla</button>
			</form>
		{/if}
	</section>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.head h1 {
		margin-bottom: 0.2rem;
	}
	.tools {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.participants {
		padding: 0.75rem 1rem;
		margin: 1rem 0;
	}
	.review-note {
		border-left: 3px solid var(--c-master);
		background: color-mix(in srgb, var(--c-master) 8%, transparent);
		padding: 0.6rem 0.9rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		white-space: pre-wrap;
	}
	.log {
		background: var(--bg-sunken);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.5rem;
	}
	.review {
		margin-top: 1.5rem;
		max-width: 720px;
	}
	.base {
		max-width: 260px;
	}
	td input {
		max-width: 120px;
	}
	.small {
		font-size: 0.85rem;
	}
	.danger-zone {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
</style>
