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
			{:else}
				<a class="button" href="/scegli-personaggio">Scegli il personaggio</a>
			{/if}
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
		<h3>Chat di luogo in tempo reale</h3>
		<p class="muted">Azioni con i dialoghi evidenziati, sussurri, interventi del Master e dei PNG: arrivano a tutti all'istante, con la turnazione sempre sotto gli occhi.</p>
	</div>
	<div class="card">
		<h3>Descrittivo, numerico in quest</h3>
		<p class="muted">Nel gioco libero si racconta; nelle quest guidate dal Master contano caratteristiche, abilità e oggetti. Si cresce con i punti esperienza.</p>
	</div>
	<div class="card">
		<h3>Un mondo da vivere</h3>
		<p class="muted">Mappe con meteo e luna, stanze private, gilde con gradi e stipendi, mercato e banca, bacheche e missive ON e OFF game.</p>
	</div>
</section>

{#if !data.user}
	<p class="first-steps muted">Prima di iscriverti leggi la <a href="/pagine/guida">guida</a> e il <a href="/pagine/regolamento">regolamento</a>.</p>
{/if}

<style>
	.first-steps {
		text-align: center;
		margin-top: 2rem;
	}
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
