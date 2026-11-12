<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	let body = $state('');
	let offNote = $state('');
	let target = $state('');
	let difficulty = $state('');

	const e = $derived(data.esito);
	const after = () => async ({ result, update }: { result: { type: string }; update: (o?: { reset?: boolean }) => Promise<void> }) => {
		if (result.type === 'success') {
			body = '';
			offNote = '';
			target = '';
			difficulty = '';
		}
		await update({ reset: false });
	};
</script>

<svelte:head><title>{e.title} · Esiti</title></svelte:head>

<p><a href={data.asMaster ? '/master/esiti' : '/esiti'}>← {data.asMaster ? 'Esiti da gestire' : 'I miei esiti'}</a></p>

<div class="head">
	<div>
		<span class="badge {e.status === 'open' ? 'accent' : ''}">{e.status === 'open' ? 'aperto' : 'chiuso'}</span>
		<h1>{e.title}</h1>
		<p class="muted">
			Richiesta di <a href="/scheda/{data.character.id}">{data.character.name}</a> · {formatDateTime(e.createdAt)} ·
			{e.master ? `Master: ${e.master}` : 'nessun Master assegnato'}
		</p>
	</div>
	<div class="tools">
		{#if data.asMaster}
			{#if !e.masterIsMe}
				<form method="post" action="?/prendi" use:enhance><button type="submit" class="secondary">Me ne occupo io</button></form>
			{:else}
				<form method="post" action="?/lascia" use:enhance><button type="submit" class="secondary">Lascia ad altri</button></form>
			{/if}
			{#if e.status === 'open'}
				<form method="post" action="?/chiudi" use:enhance><button type="submit">Chiudi esito</button></form>
			{:else}
				<form method="post" action="?/riapri" use:enhance><button type="submit" class="secondary">Riapri</button></form>
			{/if}
		{:else if e.status === 'open'}
			<form method="post" action="?/chiudi" use:enhance><button type="submit" class="secondary">Chiudi (non serve più)</button></form>
		{/if}
	</div>
</div>

<div class="messages">
	{#each data.messages as m (m.id)}
		<article class="msg" class:master={m.fromMaster}>
			<header>
				<strong>{m.fromMaster ? `Master${m.author ? ` (${m.author})` : ''}` : data.character.name}</strong>
				<span class="muted small">{formatDateTime(m.createdAt)}</span>
			</header>
			{#if m.check}
				<div class="check" class:success={m.check.outcome === 'success'} class:failure={m.check.outcome === 'failure'}>
					<strong>Prova: {m.check.skill?.name ?? m.check.stat?.name}</strong>
					<span>
						d{m.check.die}: {m.check.roll}{#if m.check.stat}{' + '}{m.check.stat.name} {m.check.stat.value}{/if}{#if m.check.skill}{' + '}rango {m.check.skill.rank}{/if}{#if m.check.bonus?.value}<span title={m.check.bonus.sources.join(', ')}>{m.check.bonus.value > 0 ? ' + ' : ' − '}oggetti {Math.abs(m.check.bonus.value)}</span>{/if}
						= <strong>{m.check.total}</strong>
					</span>
					{#if m.check.difficulty !== null}
						<span>difficoltà {m.check.difficulty}: <strong>{m.check.outcome === 'success' ? 'riuscita' : 'fallita'}</strong></span>
					{/if}
				</div>
			{/if}
			{#if m.body}<p class="body">{m.body}</p>{/if}
			{#if m.offNote}<p class="off"><span class="off-label">OFF</span> {m.offNote}</p>{/if}
		</article>
	{/each}
</div>

<form method="post" action="?/rispondi" class="stack card reply" use:enhance={after}>
	<h2>{data.asMaster ? 'Rispondi come Master' : e.status === 'closed' ? 'Aggiungi qualcosa (riapre l’esito)' : 'Aggiungi alla richiesta'}</h2>
	{#if data.asMaster}
		<fieldset class="roll">
			<legend>Prova sul personaggio <span class="hint">facoltativa · d{data.questDie} + caratteristica + rango</span></legend>
			<select name="target" bind:value={target} aria-label="Abilità o caratteristica">
				<option value="">Nessuna prova</option>
				{#if data.checkOptions.skills.length}
					<optgroup label="Abilità">
						{#each data.checkOptions.skills as s (s.id)}<option value="skill:{s.id}">{s.name}</option>{/each}
					</optgroup>
				{/if}
				<optgroup label="Caratteristiche">
					{#each data.checkOptions.stats as s (s.id)}<option value="stat:{s.id}">{s.name}</option>{/each}
				</optgroup>
			</select>
			<label class="diff">Difficoltà <input name="difficulty" type="number" min="1" max="1000" bind:value={difficulty} placeholder="—" disabled={!target} /></label>
		</fieldset>
	{/if}
	<div>
		<label for="body">{data.asMaster ? 'Esito (racconto ON game)' : 'Racconto ON game'}</label>
		<textarea id="body" name="body" rows="6" maxlength="10000" bind:value={body}></textarea>
	</div>
	<div>
		<label for="offNote">Note OFF game <span class="hint">facoltative</span></label>
		<textarea id="offNote" name="offNote" rows="2" maxlength="3000" bind:value={offNote}></textarea>
	</div>
	{#if form && 'error' in form}<p class="field-error">{form.error}</p>{/if}
	<div><button type="submit" disabled={!body.trim() && !offNote.trim() && !target}>Invia</button></div>
</form>

<style>
	.head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	h1 {
		margin: 0.4rem 0 0.2rem;
	}
	.tools {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.messages {
		display: grid;
		gap: 0.75rem;
		margin: 1.25rem 0;
		max-width: 880px;
	}
	.msg {
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.8rem 1rem;
	}
	.msg.master {
		border-left: 3px solid var(--c-master);
		background: color-mix(in srgb, var(--c-master) 7%, transparent);
	}
	.msg header {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
	}
	.body {
		white-space: pre-wrap;
		margin: 0.5rem 0 0;
	}
	.off {
		margin: 0.5rem 0 0;
		padding: 0.4rem 0.6rem;
		background: color-mix(in srgb, var(--c-whisper) 12%, transparent);
		border-radius: 4px;
		color: var(--c-whisper-text);
		white-space: pre-wrap;
		font-size: 0.92rem;
	}
	.off-label {
		font-weight: 700;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		margin-right: 0.3rem;
	}
	.check {
		margin-top: 0.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--accent);
		border-radius: 6px;
		background: color-mix(in srgb, var(--accent) 7%, transparent);
	}
	.check.success {
		border-color: var(--success);
		background: var(--success-bg);
	}
	.check.failure {
		border-color: var(--danger);
		background: var(--danger-bg);
	}
	.reply {
		max-width: 880px;
	}
	.roll {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}
	.roll legend {
		padding: 0 0.4rem;
		font-weight: 600;
	}
	.roll select {
		flex: 1 1 220px;
		width: auto;
	}
	.diff {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-weight: 400;
		margin: 0;
	}
	.diff input {
		width: 90px;
	}
	.small {
		font-size: 0.85rem;
	}
</style>
