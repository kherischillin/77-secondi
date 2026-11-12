<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { NOTIFY_OPTIONS } from '#lib/notify.ts';
	import { playTone } from '#lib/sound.ts';

	let { data, form }: PageProps = $props();
	const TEST: Record<string, 'missive' | 'whisper' | 'master'> = { soundMissive: 'missive', soundWhisper: 'whisper', soundMaster: 'master' };
</script>

<svelte:head><title>Notifiche</title></svelte:head>

<h1>Notifiche</h1>
<p class="muted">Scegli come il gioco ti avvisa delle novità. Le preferenze valgono per il tuo account, con qualsiasi personaggio.</p>

{#if form?.success}<div class="alert success">{form.success}</div>{/if}

<form method="post" class="card stack prefs" use:enhance={() => async ({ update }) => update({ reset: false, invalidateAll: true })}>
	{#each NOTIFY_OPTIONS as o (o.key)}
		<div class="pref">
			<label class="checkbox">
				<input type="checkbox" name={o.key} checked={data.prefs[o.key]} />
				<span>{o.label}</span>
			</label>
			{#if TEST[o.key]}<button type="button" class="link small" onclick={() => playTone(TEST[o.key])}>Ascolta</button>{/if}
			{#if o.hint}<p class="hint">{o.hint}</p>{/if}
		</div>
	{/each}
	<div><button type="submit">Salva</button></div>
</form>

<style>
	.prefs {
		max-width: 620px;
	}
	.pref .hint {
		margin: 0.15rem 0 0 1.9rem;
	}
	.pref .link {
		margin-left: 1.9rem;
	}
	.small {
		font-size: 0.85rem;
	}
</style>
