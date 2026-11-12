<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDateTime, fullName } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Scegli il personaggio</title></svelte:head>

<h1>Con chi giochi?</h1>
<p class="muted">Scegli il personaggio con cui entrare. Potrai cambiarlo in qualsiasi momento da <strong>Esci → Cambia personaggio</strong>.</p>

{#if form?.error}<div class="alert error">{form.error}</div>{/if}

<ul class="choices">
	{#each data.characters as c (c.id)}
		<li>
			<form method="post">
				<input type="hidden" name="id" value={c.id} />
				<button type="submit" class="choice" class:active={c.id === data.activeId}>
					<span class="pic">
						{#if c.portraitUrl}
							<img src={c.portraitUrl} alt="" referrerpolicy="no-referrer" />
						{:else}
							<span class="initial" aria-hidden="true">{c.name.slice(0, 1)}</span>
						{/if}
					</span>
					<span class="info">
						<strong>{fullName(c)}</strong>
						<span class="muted small">
							{#if c.id === data.activeId}In gioco adesso{:else if c.lastPlayedAt}Ultima giocata {formatDateTime(c.lastPlayedAt)}{:else}Mai giocato{/if}
						</span>
					</span>
				</button>
			</form>
		</li>
	{/each}
</ul>

<p class="muted small">Per creare o eliminare un personaggio vai in <a href="/account">Impostazioni → Il mio account</a>.</p>

<style>
	.choices {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
		gap: 1rem;
	}
	.choice {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-start;
		padding: 0;
		overflow: hidden;
		text-align: left;
		background: var(--bg-raised);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.choice:hover,
	.choice:focus-visible {
		border-color: var(--accent);
	}
	.choice.active {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.pic {
		display: block;
		width: 100%;
		aspect-ratio: 7 / 10;
		background: var(--bg-sunken);
	}
	.pic img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.initial {
		display: grid;
		place-items: center;
		height: 100%;
		font-family: var(--font-title);
		font-size: 4rem;
		color: var(--accent);
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.6rem 0.8rem 0.75rem;
	}
	.small {
		font-size: 0.82rem;
	}
</style>
