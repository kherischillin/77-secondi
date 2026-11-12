<script lang="ts">
	import { page } from '$app/state';

	/** Barra comune a inventario, mercato e banca, con il denaro del personaggio. */
	let { cash, bank, currency }: { cash: number; bank: number; currency: string } = $props();

	const links = [
		{ href: '/inventario', label: 'Inventario' },
		{ href: '/mercato', label: 'Mercato' },
		{ href: '/banca', label: 'Banca' },
		{ href: '/lavori', label: 'Lavori' }
	];
	const fmt = (n: number) => n.toLocaleString('it-IT', { useGrouping: 'always' });
</script>

<div class="econ-nav">
	<nav aria-label="Economia">
		{#each links as l (l.href)}
			<a href={l.href} aria-current={page.url.pathname.startsWith(l.href) ? 'page' : undefined}>{l.label}</a>
		{/each}
	</nav>
	<p class="purse">
		<span><span class="muted">In tasca</span> <strong data-testid="cash">{fmt(cash)}</strong></span>
		<span><span class="muted">In banca</span> <strong data-testid="bank">{fmt(bank)}</strong></span>
		<span class="muted">{currency}</span>
	</p>
</div>

<style>
	.econ-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		border-bottom: 1px solid var(--border);
		margin-bottom: 1.5rem;
	}
	nav {
		display: flex;
		gap: 1.25rem;
	}
	nav a {
		padding: 0.5rem 0;
		color: var(--text-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}
	nav a[aria-current='page'] {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}
	.purse {
		display: flex;
		gap: 1rem;
		margin: 0;
		font-size: 0.95rem;
	}
	.purse strong {
		font-variant-numeric: tabular-nums;
		color: var(--accent-strong, var(--accent));
	}
</style>
