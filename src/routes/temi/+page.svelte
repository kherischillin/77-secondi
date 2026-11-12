<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { THEMES, THEME_IDS } from '#lib/themes.ts';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Temi</title></svelte:head>

<h1>Temi</h1>
<p class="muted">Scegli l'aspetto del sito solo per te. Gli altri giocatori continuano a vedere il tema che hanno scelto loro.</p>

{#if form?.success}<div class="alert success">{form.success}</div>{/if}
{#if form?.error}<div class="alert error">{form.error}</div>{/if}

<form method="post" class="card themes" use:enhance={() => async ({ update }) => update({ reset: false, invalidateAll: true })}>
	<label class="theme">
		<input type="radio" name="theme" value="" checked={!data.theme} />
		<span><strong>Quello del sito</strong> <span class="hint">scelto dallo staff ({THEMES[data.siteTheme].label})</span></span>
	</label>
	{#each THEME_IDS as id (id)}
		<label class="theme">
			<input type="radio" name="theme" value={id} checked={data.theme === id} />
			<span class="swatch" aria-hidden="true">{#each THEMES[id].swatch as c (c)}<span style="background: {c}"></span>{/each}</span>
			<span><strong>{THEMES[id].label}</strong> <span class="hint">{THEMES[id].description}</span></span>
		</label>
	{/each}
	<div><button type="submit">Usa questo tema</button></div>
</form>

<style>
	.themes {
		display: grid;
		gap: 0.75rem;
		max-width: 620px;
	}
	.theme {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		font-weight: 400;
		margin: 0;
		cursor: pointer;
	}
	.theme input {
		width: auto;
	}
	.swatch {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
		flex: 0 0 auto;
	}
	.swatch span {
		width: 18px;
		height: 22px;
	}
</style>
