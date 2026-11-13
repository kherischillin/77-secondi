<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import type { LayoutProps } from './$types';
	import NavMenu from '#lib/components/NavMenu.svelte';
	import { playTone } from '#lib/sound.ts';

	let { data, children }: LayoutProps = $props();

	const canManage = $derived(data.user?.capabilities.includes('admin.access') ?? false);

	// Voce attiva della barra: la pagina corrente inizia con quel percorso.
	const here = (prefix: string) =>
		page.url.pathname === prefix || page.url.pathname.startsWith(prefix + '/') ? ('page' as const) : undefined;
	const OFFICES = ['/gilde', '/banca', '/mercato', '/lavori', '/stanze-private', '/archivio-giocate', '/pagine'];
	const mapHref = $derived(data.mainMapId ? `/gioco/mappa/${data.mainMapId}` : '/gioco');
	const staffCount = $derived((data.masterPending ?? 0) + (canManage ? data.reportsOpen : 0));

	// Menu ☰ su schermi stretti: si chiude cambiando pagina.
	let menuOpen = $state(false);
	afterNavigate(() => (menuOpen = false));

	// Missive non lette: il valore arriva con ogni pagina e si aggiorna ogni 30 secondi.
	let polled = $state<number | null>(null);
	const unread = $derived(polled ?? data.unreadMessages);
	const totalCount = $derived(unread + data.esitiUnread + (data.masterPending ?? 0) + (data.user?.capabilities.includes('admin.access') ? data.reportsOpen : 0));
	$effect(() => {
		void data.unreadMessages;
		polled = null;
	});

	async function refreshUnread() {
		if (!data.character) return;
		try {
			const res = await fetch('/missive/non-lette');
			if (res.ok) {
				const count = (await res.json()).count;
				if (data.notify.soundMissive && count > unread) playTone('missive');
				polled = count;
			}
		} catch {
			// Rete assente: si riprova al giro successivo.
		}
	}

	onMount(() => {
		const timer = setInterval(() => {
			if (!document.hidden) refreshUnread();
		}, 30_000);
		return () => clearInterval(timer);
	});

	// Aprendo una missiva il conteggio va ricalcolato dopo che è stata segnata come letta.
	afterNavigate(({ to }) => {
		if (to?.url.pathname.startsWith('/missive/')) refreshUnread();
	});

	// Cambiando tema (account o impostazioni) la pagina si aggiorna senza ricaricare.
	$effect(() => {
		document.documentElement.dataset.theme = data.theme;
	});

	// Il numero compare anche nel titolo della scheda del browser, come in GDRCD.
	$effect(() => {
		const count = data.notify.titleCount ? unread : 0;
		void page.url.pathname; // si ricalcola anche dopo ogni cambio di pagina
		const timer = setTimeout(() => {
			const base = document.title.replace(/^\(\d+\) /, '');
			document.title = count > 0 ? `(${count}) ${base}` : base;
		}, 0);
		return () => clearTimeout(timer);
	});
	const landing = $derived(page.url.pathname === '/' && !data.user);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if data.customCss}<link rel="stylesheet" href="/tema.css" />{/if}
	<title>{data.siteName}</title>
</svelte:head>

<!-- Nella pagina iniziale, per chi non è entrato, niente barra: accesso e iscrizione sono già nella pagina. -->
{#if !landing}
<header class="site-header">
	<div class="container bar">
		<a class="brand" href="/">{data.siteName}</a>
		{#if data.user}
			<button
				type="button"
				class="burger"
				aria-expanded={menuOpen}
				aria-controls="main-nav"
				aria-label={menuOpen ? 'Chiudi il menu' : 'Apri il menu'}
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
				{#if totalCount > 0 && !menuOpen}<span class="count">{totalCount}</span>{/if}
			</button>
		{/if}
		<nav id="main-nav" class="main-nav" class:open={menuOpen} aria-label="Navigazione principale">
			{#if data.user}
				{#if data.character}
					<a href="/scheda/{data.character.id}" class="with-count me" aria-current={here(`/scheda/${data.character.id}`)} title="La tua scheda">
						<strong>{data.character.name}</strong>{#if data.esitiUnread > 0}<span class="count" aria-label="{data.esitiUnread} esiti con novità">{data.esitiUnread}</span>{/if}
					</a>
					<a href="/missive" class="with-count" aria-current={here('/missive')}>
						Missive{#if unread > 0}<span class="count" aria-label="{unread} non lette">{unread}</span>{/if}
					</a>
					<a href={mapHref} aria-current={here('/gioco/mappa') || here('/gioco/luogo')}>Mappa</a>
					<a href="/gioco/presenti" aria-current={here('/gioco/presenti')}>Presenti</a>
					<a href="/bacheche" aria-current={here('/bacheche')}>Bacheche</a>
					<NavMenu id="uffici" current={OFFICES.some((o) => !!here(o))}>
						{#snippet label()}Uffici{/snippet}
						<a href="/gilde" aria-current={here('/gilde')}>Gilde</a>
						<a href="/banca" aria-current={here('/banca')}>Banca</a>
						<a href="/mercato" aria-current={here('/mercato')}>Mercato</a>
						<a href="/lavori" aria-current={here('/lavori')}>Lavori</a>
						<a href="/stanze-private" aria-current={here('/stanze-private')}>Stanze private</a>
						<a href="/archivio-giocate" aria-current={here('/archivio-giocate')}>Archivio giocate</a>
						{#if data.footerPages.length}
							<hr />
							{#each data.footerPages as p (p.slug)}<a href="/pagine/{p.slug}" aria-current={here(`/pagine/${p.slug}`)}>{p.title}</a>{/each}
						{/if}
					</NavMenu>
				{/if}
				<NavMenu id="impostazioni" current={!!(here('/account') || here('/temi') || here('/notifiche'))}>
					{#snippet label()}Impostazioni{/snippet}
					<a href="/account" aria-current={here('/account')}>Il mio account</a>
					<a href="/temi" aria-current={here('/temi')}>Temi</a>
					<a href="/notifiche" aria-current={here('/notifiche')}>Notifiche</a>
				</NavMenu>
				{#if data.masterPending !== null || canManage}
					<NavMenu id="gestione" current={!!(here('/master') || here('/gestione'))}>
						{#snippet label()}
							<span class="with-count">Gestione{#if staffCount > 0}<span class="count" aria-label="{staffCount} cose da gestire">{staffCount}</span>{/if}</span>
						{/snippet}
						{#if data.masterPending !== null}
							<a href="/master" aria-current={here('/master')}>
								Spazio Master{#if data.masterPending > 0}<span class="count" aria-label="{data.masterPending} da gestire">{data.masterPending}</span>{/if}
							</a>
						{/if}
						{#if canManage}
							<a href="/gestione" aria-current={here('/gestione')}>
								Pannello di controllo{#if data.reportsOpen > 0}<span class="count" aria-label="{data.reportsOpen} segnalazioni aperte">{data.reportsOpen}</span>{/if}
							</a>
						{/if}
					</NavMenu>
				{/if}
				<NavMenu id="esci">
					{#snippet label()}Esci{/snippet}
					<a href="/scegli-personaggio" aria-current={here('/scegli-personaggio')}>Cambia personaggio</a>
					<hr />
					<form method="post" action="/esci">
						<button type="submit">Esci dal gioco</button>
					</form>
				</NavMenu>
			{:else}
				<a href="/accesso">Accedi</a>
				<a class="button" href="/registrazione">Iscriviti</a>
			{/if}
		</nav>
	</div>
</header>
{/if}

<main class="container page" class:landing>
	{@render children()}
</main>

<footer class="container site-footer muted">
	<span>{data.siteName} · {data.siteTagline}</span>
	{#if data.footerPages.length}
		<nav aria-label="Pagine informative">
			{#each data.footerPages as p (p.slug)}<a href="/pagine/{p.slug}">{p.title}</a>{/each}
		</nav>
	{/if}
</footer>

<style>
	.site-header {
		border-bottom: 1px solid var(--border);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 35%, transparent);
		background: var(--header-bg);
		backdrop-filter: blur(6px);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		min-height: 60px;
		padding-block: 0.5rem;
	}
	.brand {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 800;
		text-transform: var(--title-transform);
		letter-spacing: var(--title-spacing);
		color: var(--accent);
		text-shadow: var(--title-glow);
		text-decoration: none;
	}
	.main-nav {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		display: flex;
		align-items: center;
		gap: 0.4rem 1.1rem;
		flex-wrap: wrap;
	}
	.main-nav > a:not(.button) {
		text-decoration: none;
		color: var(--text-muted);
	}
	.main-nav > a:not(.button):hover,
	.main-nav > a[aria-current='page'] {
		color: var(--text);
	}
	.main-nav > a.me {
		color: var(--accent);
	}
	.main-nav form {
		display: contents;
	}
	.burger {
		display: none;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: var(--radius);
		padding: 0.3rem 0.7rem;
		font-size: 1.2rem;
		line-height: 1;
		min-height: 0;
		cursor: pointer;
	}
	/* Telefono: la barra diventa un pulsante ☰ che apre l'elenco dei menu. */
	@media (max-width: 900px) {
		.burger {
			display: inline-flex;
		}
		.main-nav {
			display: none;
			width: 100%;
			flex-direction: column;
			align-items: stretch;
			gap: 0.2rem;
			padding: 0.5rem 0 0.75rem;
			border-top: 1px solid var(--border);
		}
		.main-nav.open {
			display: flex;
		}
		.main-nav > :global(*) {
			padding: 0.4rem 0.2rem;
		}
	}
	.with-count {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.count {
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0 0.45rem;
		line-height: 1.5;
	}
	.page {
		padding-block: 2rem 3rem;
		min-height: calc(100vh - 140px);
	}
	.page.landing {
		min-height: calc(100vh - 80px);
	}
	.site-footer {
		padding-block: 1.5rem;
		border-top: 1px solid var(--border);
		font-size: 0.85rem;
		display: flex;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		flex-wrap: wrap;
	}
	.site-footer nav {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.site-footer a {
		color: var(--text-muted);
	}
	.site-footer a:hover {
		color: var(--accent);
	}
</style>
