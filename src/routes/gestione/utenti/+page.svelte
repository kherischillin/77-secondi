<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDate, formatDateTime } from '#lib/format.ts';

	let { data }: PageProps = $props();

	function pageUrl(n: number) {
		const params = new URLSearchParams();
		if (data.q) params.set('q', data.q);
		if (n > 1) params.set('pagina', String(n));
		const s = params.toString();
		return s ? `?${s}` : '?';
	}
</script>

<svelte:head><title>Account · Gestione</title></svelte:head>

<h1>Account</h1>

<form method="get" class="search">
	<label for="q" class="visually-hidden">Cerca</label>
	<input id="q" name="q" type="text" placeholder="Cerca per nome utente, email o personaggio" value={data.q} />
	<button type="submit" class="secondary">Cerca</button>
</form>

<div class="table-wrap card">
	<table>
		<thead>
			<tr>
				<th>Account</th>
				<th>Personaggi</th>
				<th>Ruoli</th>
				<th>Iscritto</th>
				<th>Ultimo accesso</th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<td>
						<a href="/gestione/utenti/{u.id}">{u.username}</a>
						{#if u.banned}<span class="badge danger">sospeso</span>{/if}
						<br /><span class="muted small">{u.email}</span>
					</td>
					<td>{u.characters.join(', ') || '—'}</td>
					<td>
						{#each u.roles as r (r)}<span class="badge">{r}</span>{/each}
					</td>
					<td>{formatDate(u.createdAt)}</td>
					<td>{formatDateTime(u.lastLoginAt)}</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="muted">Nessun account trovato.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<nav class="pager" aria-label="Pagine">
	{#if data.page > 1}<a href={pageUrl(data.page - 1)}>← Precedenti</a>{/if}
	{#if data.hasNext}<a href={pageUrl(data.page + 1)}>Successivi →</a>{/if}
</nav>

<style>
	.search {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		max-width: 560px;
	}
	.small {
		font-size: 0.85rem;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
