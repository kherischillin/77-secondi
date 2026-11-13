<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = $derived(
		[
			{ href: '/gestione', label: 'Panoramica', cap: 'admin.access' },
			{ href: '/gestione/utenti', label: 'Account', cap: 'users.view' },
			{ href: '/gestione/ruoli', label: 'Ruoli', cap: 'roles.manage' },
			{ href: '/gestione/mondo', label: 'Mappe e luoghi', cap: 'world.manage' },
			{ href: '/gestione/regole', label: 'Regole di gioco', cap: 'rules.manage' },
			{ href: '/gestione/gilde', label: 'Gilde', cap: 'guilds.manage' },
			{ href: '/gestione/bacheche', label: 'Bacheche', cap: 'boards.manage' },
			{ href: '/gestione/oggetti', label: 'Oggetti e mercato', cap: 'items.manage' },
			{ href: '/gestione/negozi', label: 'Negozi', cap: 'items.manage' },
			{ href: '/gestione/economia', label: 'Economia', cap: 'economy.manage' },
			{ href: '/gestione/lavori', label: 'Lavori', cap: 'economy.manage' },
			{ href: '/gestione/segnalazioni', label: 'Segnalazioni', cap: 'reports.handle' },
			{ href: '/gestione/home', label: 'Pagina iniziale', cap: 'home.manage' },
			{ href: '/gestione/pagine', label: 'Pagine', cap: 'pages.manage' },
			{ href: '/gestione/importa', label: 'Importa da GDRCD', cap: 'import.run' },
			{ href: '/gestione/impostazioni', label: 'Impostazioni', cap: 'settings.manage' },
			{ href: '/gestione/registro', label: 'Registro attività', cap: 'audit.view' }
		].filter((l) => data.adminCapabilities.includes(l.cap))
	);

	function isCurrent(href: string) {
		const path = page.url.pathname;
		return href === '/gestione' ? path === href : path.startsWith(href);
	}
</script>

<div class="admin">
	<nav class="sidebar" aria-label="Sezioni di gestione">
		<p class="title">Gestione</p>
		{#each links as link (link.href)}
			<a href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label}</a>
		{/each}
	</nav>
	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.admin {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 2rem;
		align-items: start;
	}
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		position: sticky;
		top: 80px;
	}
	.title {
		font-family: var(--font-title);
		font-size: 1.2rem;
		margin-bottom: 0.5rem;
	}
	.sidebar a {
		padding: 0.45rem 0.75rem;
		border-radius: var(--radius);
		color: var(--text-muted);
		text-decoration: none;
	}
	.sidebar a:hover {
		background: var(--bg-raised);
		color: var(--text);
	}
	.sidebar a[aria-current='page'] {
		background: var(--bg-raised);
		color: var(--accent);
		border-left: 3px solid var(--accent);
	}
	.content {
		min-width: 0;
	}
	@media (max-width: 760px) {
		.admin {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		.sidebar {
			position: static;
			flex-direction: row;
			flex-wrap: wrap;
		}
		.title {
			display: none;
		}
	}
</style>
