<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const canManage = $derived(data.user?.capabilities.includes('admin.access') ?? false);

	// Missive non lette: il valore arriva con ogni pagina e si aggiorna ogni 30 secondi.
	let polled = $state<number | null>(null);
	const unread = $derived(polled ?? data.unreadMessages);
	$effect(() => {
		void data.unreadMessages;
		polled = null;
	});

	async function refreshUnread() {
		if (!data.character) return;
		try {
			const res = await fetch('/missive/non-lette');
			if (res.ok) polled = (await res.json()).count;
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

	// Il numero compare anche nel titolo della scheda del browser, come in GDRCD.
	$effect(() => {
		const count = unread;
		void page.url.pathname; // si ricalcola anche dopo ogni cambio di pagina
		const timer = setTimeout(() => {
			const base = document.title.replace(/^\(\d+\) /, '');
			document.title = count > 0 ? `(${count}) ${base}` : base;
		}, 0);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.siteName}</title>
</svelte:head>

<header class="site-header">
	<div class="container bar">
		<a class="brand" href="/">{data.siteName}</a>
		<nav aria-label="Navigazione principale">
			{#if data.user}
				{#if data.character}
					<a href="/gioco">Gioca come <strong>{data.character.name}</strong></a>
					<a href="/missive" class="with-count">
						Missive{#if unread > 0}<span class="count" aria-label="{unread} non lette">{unread}</span>{/if}
					</a>
				{/if}
				<a href="/bacheche">Bacheche</a>
				<a href="/gilde">Gilde</a>
				<a href="/account">Il mio account</a>
				{#if canManage}
					<a href="/gestione">Gestione</a>
				{/if}
				<form method="post" action="/esci">
					<button class="link" type="submit">Esci</button>
				</form>
			{:else}
				<a href="/accesso">Accedi</a>
				<a class="button" href="/registrazione">Iscriviti</a>
			{/if}
		</nav>
	</div>
</header>

<main class="container page">
	{@render children()}
</main>

<footer class="container site-footer muted">
	{data.siteName} · {data.siteTagline}
</footer>

<style>
	.site-header {
		border-bottom: 1px solid var(--border);
		background: rgba(15, 13, 11, 0.85);
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
		font-family: var(--font-title);
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	nav a:not(.button) {
		text-decoration: none;
		color: var(--text-muted);
	}
	nav a:not(.button):hover {
		color: var(--text);
	}
	nav form {
		display: inline;
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
	.site-footer {
		padding-block: 1.5rem;
		border-top: 1px solid var(--border);
		font-size: 0.85rem;
	}
</style>
