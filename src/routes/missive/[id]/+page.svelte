<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime, fullName } from '#lib/format.ts';
	import ReportButton from '#lib/components/ReportButton.svelte';

	let { data, form }: PageProps = $props();
	let body = $state('');
</script>

<svelte:head><title>{data.thread.subject} · Missive</title></svelte:head>

<p><a href="/missive">← Missive</a></p>
<div class="head">
	<div>
		<span class="badge {data.thread.onGame ? 'accent' : ''}">{data.thread.onGame ? 'ON game' : 'OFF game'}</span>
		<h1>{data.thread.subject}</h1>
		<p class="muted">
			Con
			{#each data.others as o, i (o.id)}{i > 0 ? ', ' : ''}<a href="/scheda/{o.id}">{fullName(o)}</a>{/each}
		</p>
	</div>
	<form method="post" action={data.thread.archived ? '?/ripristina' : '?/archivia'} use:enhance>
		<button type="submit" class="secondary">{data.thread.archived ? 'Riporta in arrivo' : 'Archivia'}</button>
	</form>
</div>

{#if !data.thread.onGame}
	<p class="off-note">Conversazione OFF game: quello che vi dite qui non lo sanno i personaggi.</p>
{/if}

<div class="messages">
	{#each data.messages as m (m.id)}
		<article class="msg" class:mine={m.senderId === data.me}>
			<header>
				<strong>{m.senderName}</strong>
				<span class="muted small">{formatDateTime(m.createdAt)}</span>
				{#if m.senderId !== data.me}<span class="rep"><ReportButton targetType="private_message" targetId={m.id} /></span>{/if}
			</header>
			<p>{m.body}</p>
		</article>
	{/each}
</div>

<form
	method="post"
	action="?/rispondi"
	class="stack card reply"
	use:enhance={() => async ({ result, update }) => {
		if (result.type === 'success') body = '';
		await update({ reset: false });
	}}
>
	<label for="body">Rispondi</label>
	<textarea id="body" name="body" rows="5" maxlength="10000" required bind:value={body}></textarea>
	{#if form?.error}<p class="field-error">{form.error}</p>{/if}
	<div><button type="submit" disabled={!body.trim()}>Invia risposta</button></div>
</form>

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
	.off-note {
		border-left: 3px solid var(--c-whisper);
		padding: 0.4rem 0.75rem;
		color: var(--c-whisper-text);
		background: color-mix(in srgb, var(--c-whisper) 10%, transparent);
		border-radius: 4px;
	}
	.messages {
		display: grid;
		gap: 0.75rem;
		margin: 1.25rem 0;
		max-width: 820px;
	}
	.msg {
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		max-width: 90%;
	}
	.msg.mine {
		justify-self: end;
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		background: color-mix(in srgb, var(--accent) 6%, transparent);
	}
	.rep {
		margin-left: auto;
	}
	.msg header {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.msg p {
		margin: 0.4rem 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.reply {
		max-width: 820px;
	}
	.small {
		font-size: 0.85rem;
	}
</style>
