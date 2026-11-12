<script lang="ts">
	import CharacterInput from '#lib/components/CharacterInput.svelte';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form?.errors ?? {});
	const v = $derived(form?.values);
</script>

<svelte:head><title>Nuova missiva · {data.siteName}</title></svelte:head>

<p><a href="/missive">← Missive</a></p>
<h1>Nuova missiva</h1>

<form method="post" class="stack card compose" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<fieldset class="kind">
		<legend>Tipo</legend>
		<label class="checkbox">
			<input type="radio" name="onGame" value="on" checked={v ? v.onGame : true} />
			<span><strong>ON game</strong><span class="hint">Scritta dal tuo personaggio a un altro personaggio, dentro la storia.</span></span>
		</label>
		<label class="checkbox">
			<input type="radio" name="onGame" value="off" checked={v ? !v.onGame : false} />
			<span><strong>OFF game</strong><span class="hint">Tra giocatori: organizzarsi, chiedere, accordarsi. Il personaggio non ne sa nulla.</span></span>
		</label>
	</fieldset>
	<div>
		<label for="to">Destinatario <span class="hint">nome del personaggio</span></label>
		<CharacterInput id="to" name="to" label="Destinatario" required value={v?.to ?? data.to} placeholder="Scrivi le prime lettere del nome" />
		{#if errors.to}<p class="field-error">{errors.to}</p>{/if}
	</div>
	<div>
		<label for="subject">Oggetto</label>
		<input id="subject" name="subject" type="text" maxlength="120" required value={v?.subject ?? ''} />
		{#if errors.subject}<p class="field-error">{errors.subject}</p>{/if}
	</div>
	<div>
		<label for="body">Messaggio</label>
		<textarea id="body" name="body" rows="10" maxlength="10000" required>{v?.body ?? ''}</textarea>
		{#if errors.body}<p class="field-error">{errors.body}</p>{/if}
	</div>
	<div><button type="submit">Invia missiva</button></div>
</form>

<style>
	.compose {
		max-width: 720px;
	}
	.kind {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	legend {
		padding: 0 0.4rem;
		font-weight: 600;
	}
</style>
