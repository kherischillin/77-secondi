<script lang="ts">
	import type { PageProps } from './$types';
	import CitySkyline from '#lib/components/CitySkyline.svelte';
	import { formatDate } from '#lib/format.ts';

	let { data }: PageProps = $props();
	const paragraphs = $derived(data.home.welcomeText.split(/\n\s*\n/).filter((p) => p.trim()));
</script>

<svelte:head><title>{data.siteName}{data.siteTagline ? ` · ${data.siteTagline}` : ''}</title></svelte:head>

<!-- Sfondo a tutta pagina: l'immagine scelta dallo staff, oppure lo skyline disegnato con i colori del tema. -->
<div class="backdrop" aria-hidden="true">
	{#if data.home.backgroundUrl}
		<img src={data.home.backgroundUrl} alt="" />
	{:else}
		<CitySkyline />
	{/if}
	<div class="shade"></div>
</div>

<section class="home">
	<header class="title">
		{#if data.home.chapter}<p class="chapter">{data.home.chapter}</p>{/if}
		<h1>{data.siteName}</h1>
	</header>

	<div class="grid">
		<aside class="left">
			<div class="panel present">
				<p class="count"><span>Presenti</span> <strong>{data.online}</strong></p>
				{#if data.home.presentLine}<p class="line">{data.home.presentLine}</p>{/if}
			</div>

			{#if data.user}
				<div class="panel stack-sm">
					{#if data.character}
						<p class="who">Bentornato, <strong>{data.character.name}</strong>.</p>
						<a class="button wide" href="/gioco">Entra in gioco</a>
						<a class="button secondary wide" href="/scegli-personaggio">Cambia personaggio</a>
					{:else}
						<p class="who">Bentornato, <strong>{data.user.username}</strong>.</p>
						<a class="button wide" href="/scegli-personaggio">Scegli il personaggio</a>
					{/if}
				</div>
			{:else}
				<form class="panel login" method="post" action="/accesso">
					<label class="sr-only" for="home-user">Nome utente, email o personaggio</label>
					<input id="home-user" name="username" type="text" autocomplete="username" placeholder="Nome utente o email" required maxlength="254" />
					<label class="sr-only" for="home-pass">Password</label>
					<input id="home-pass" name="password" type="password" autocomplete="current-password" placeholder="Password" required maxlength="200" />
					<button type="submit" class="wide">Entra</button>
				</form>
			{/if}

			{#if data.home.welcomeTitle || paragraphs.length}
				<div class="panel welcome">
					{#if data.home.welcomeTitle}<h2>{data.home.welcomeTitle}</h2>{/if}
					{#each paragraphs as p, i (i)}<p>{p}</p>{/each}
				</div>
			{/if}

			{#if !data.user}
				{#if data.registrationsOpen}
					<a class="button cta" href="/registrazione">Iscriviti e crea il tuo personaggio</a>
				{:else}
					<p class="panel closed">Le iscrizioni sono chiuse per il momento.</p>
				{/if}
			{/if}
		</aside>

		<!-- Colonna centrale vuota: lascia vedere lo sfondo. -->
		<div class="spacer"></div>

		<aside class="panel news" aria-labelledby="news-title">
			<header class="news-head">
				<h2 id="news-title">News</h2>
				{#if data.canManageHome}<a class="small" href="/gestione/home">Gestisci</a>{/if}
			</header>
			{#if data.news.length === 0}
				<p class="muted">Ancora nessuna news.</p>
			{:else}
				<ul>
					{#each data.news as n (n.id)}
						<li class:pinned={n.isPinned}>
							{#if n.html}
								<details>
									<summary>
										<span class="n-title">{n.title}</span>
										{#if n.summary}<span class="n-summary">{n.summary}</span>{/if}
									</summary>
									<!-- Testo già reso sicuro da renderMarkup. -->
									<div class="n-body prose">{@html n.html}</div>
								</details>
							{:else}
								<span class="n-title">{n.title}</span>
								{#if n.summary}<span class="n-summary">{n.summary}</span>{/if}
							{/if}
							<span class="n-date">{formatDate(n.createdAt)}{#if n.isPinned} · in evidenza{/if}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</div>
</section>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
	}
	.backdrop img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* Velo scuro: i pannelli restano leggibili su qualsiasi immagine. */
	.shade {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to bottom, color-mix(in srgb, var(--bg) 55%, transparent), transparent 35%, transparent 65%, color-mix(in srgb, var(--bg) 70%, transparent)),
			linear-gradient(to right, color-mix(in srgb, var(--bg) 45%, transparent), transparent 30%, transparent 70%, color-mix(in srgb, var(--bg) 45%, transparent));
	}
	.home {
		min-height: calc(100vh - 150px);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.title {
		text-align: right;
	}
	.chapter {
		margin: 0;
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--accent-2);
		font-size: clamp(1rem, 2.2vw, 1.4rem);
		text-shadow: 0 0 12px color-mix(in srgb, var(--accent-2) 60%, transparent);
	}
	.title h1 {
		margin: 0;
		font-size: clamp(2.2rem, 7vw, 4.6rem);
		line-height: 1;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--accent);
		text-shadow:
			0 0 18px color-mix(in srgb, var(--accent) 65%, transparent),
			0 2px 0 color-mix(in srgb, black 60%, transparent);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(250px, 300px) minmax(0, 1fr) minmax(300px, 400px);
		gap: 1.25rem;
		align-items: start;
		flex: 1;
	}
	@media (max-width: 1000px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
		.spacer {
			display: none;
		}
	}
	@media (max-width: 680px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.title {
			text-align: left;
		}
	}
	.panel {
		background: color-mix(in srgb, var(--bg-raised) 80%, transparent);
		backdrop-filter: blur(6px);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
		box-shadow: var(--shadow);
	}
	.left {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.present {
		text-align: center;
	}
	.count {
		margin: 0;
		font-family: var(--font-display);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 1.15rem;
	}
	.count strong {
		color: var(--accent);
		font-size: 1.6rem;
		text-shadow: 0 0 10px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.line {
		margin: 0.15rem 0 0;
		color: var(--text-muted);
		font-style: italic;
		font-size: 0.9rem;
	}
	.login,
	.stack-sm {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.who {
		margin: 0;
	}
	.wide {
		width: 100%;
		text-align: center;
	}
	.welcome h2 {
		font-size: 1.05rem;
		margin: 0 0 0.4rem;
		color: var(--accent);
	}
	.welcome p {
		margin: 0 0 0.6rem;
		font-size: 0.92rem;
		line-height: 1.55;
	}
	.welcome p:last-child {
		margin-bottom: 0;
	}
	.cta {
		text-align: center;
		padding-block: 0.8rem;
	}
	.closed {
		margin: 0;
		text-align: center;
		color: var(--text-muted);
	}
	.news-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
		margin-bottom: 0.4rem;
	}
	.news h2 {
		margin: 0 0 0.3rem;
		font-size: 1.3rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
	}
	.news ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 60vh;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.news li {
		padding: 0.5rem 0.35rem;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.news li.pinned {
		border-left: 3px solid var(--accent);
		padding-left: 0.6rem;
	}
	.n-title {
		font-weight: 700;
		color: var(--accent-strong, var(--accent));
	}
	.n-summary {
		display: block;
		font-size: 0.88rem;
		font-style: italic;
		color: var(--accent-2);
	}
	.n-date {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	summary {
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary .n-title::after {
		content: ' ▸';
		color: var(--text-muted);
		font-weight: 400;
	}
	details[open] summary .n-title::after {
		content: ' ▾';
	}
	.n-body {
		font-size: 0.9rem;
		margin-top: 0.4rem;
	}
	.n-body :global(p) {
		margin: 0 0 0.5rem;
	}
	.small {
		font-size: 0.85rem;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
