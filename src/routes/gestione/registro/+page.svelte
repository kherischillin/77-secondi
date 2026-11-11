<script lang="ts">
	import type { PageProps } from './$types';
	import { formatDateTime } from '#lib/format.ts';

	let { data }: PageProps = $props();

	function pageUrl(n: number) {
		const params = new URLSearchParams();
		if (data.action) params.set('azione', data.action);
		if (n > 1) params.set('pagina', String(n));
		const s = params.toString();
		return s ? `?${s}` : '?';
	}
</script>

<svelte:head><title>Registro attività · Gestione</title></svelte:head>

<h1>Registro attività</h1>

<form method="get" class="filter">
	<label for="azione">Filtra per azione</label>
	<select id="azione" name="azione" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
		<option value="">Tutte</option>
		{#each Object.entries(data.labels) as [key, label] (key)}
			<option value={key} selected={data.action === key}>{label}</option>
		{/each}
	</select>
	<noscript><button type="submit" class="secondary">Filtra</button></noscript>
</form>

<div class="table-wrap card">
	<table>
		<thead>
			<tr>
				<th>Quando</th>
				<th>Chi</th>
				<th>Azione</th>
				<th>Dettagli</th>
				<th>IP</th>
			</tr>
		</thead>
		<tbody>
			{#each data.entries as e (e.id)}
				<tr>
					<td class="nowrap">{formatDateTime(e.createdAt)}</td>
					<td>{e.actor ?? '—'}</td>
					<td>{data.labels[e.action] ?? e.action}</td>
					<td class="details">
						{#if e.targetType}<span class="muted">{e.targetType} #{e.targetId}</span>{/if}
						{#if e.details}<code>{e.details}</code>{/if}
					</td>
					<td class="muted nowrap">{e.ip ?? ''}</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="muted">Nessuna attività registrata.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<nav class="pager" aria-label="Pagine">
	{#if data.page > 1}<a href={pageUrl(data.page - 1)}>← Più recenti</a>{/if}
	{#if data.hasNext}<a href={pageUrl(data.page + 1)}>Meno recenti →</a>{/if}
</nav>

<style>
	.filter {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 1rem;
		max-width: 480px;
	}
	.filter label {
		margin: 0;
		white-space: nowrap;
	}
	.nowrap {
		white-space: nowrap;
	}
	.details code {
		display: block;
		font-size: 0.8rem;
		word-break: break-word;
		color: var(--text-muted);
	}
	.pager {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem;
	}
</style>
