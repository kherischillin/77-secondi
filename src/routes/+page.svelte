<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<section class="hero">
	<h1>{data.siteName}</h1>
	<p class="tagline">{data.siteTagline}</p>

	{#if data.user}
		<div class="actions">
			{#if data.character}
				<a class="button" href="/gioco">Entra in gioco come {data.character.name}</a>
			{/if}
			<a class="button secondary" href="/account">I miei personaggi</a>
		</div>
	{:else}
		<div class="actions">
			<a class="button" href="/registrazione">Crea un account</a>
			<a class="button secondary" href="/accesso">Ho già un account</a>
		</div>
	{/if}
</section>

<section class="grid features">
	<div class="card">
		<h3>Un account, più personaggi</h3>
		<p class="muted">Ogni giocatore ha un solo account e può dare vita a più personaggi, ognuno con la sua storia.</p>
	</div>
	<div class="card">
		<h3>Chat di luogo in tempo reale</h3>
		<p class="muted">Azioni, parlato, sussurri e interventi del Master arrivano a tutti all'istante. In arrivo nella prossima fase.</p>
	</div>
	<div class="card">
		<h3>Un mondo da esplorare</h3>
		<p class="muted">Mappe, luoghi e stanze private dove intrecciare le vostre giocate.</p>
	</div>
</section>

<style>
	.hero {
		text-align: center;
		padding: 3rem 0 2.5rem;
	}
	.tagline {
		font-size: 1.2rem;
		color: var(--text-muted);
		font-family: var(--font-title);
		font-style: italic;
	}
	.actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 1.5rem;
	}
	.features {
		margin-top: 1rem;
	}
</style>
