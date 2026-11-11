<script lang="ts">
	import { formatDateTime } from '#lib/format.ts';

	type Board = {
		id: number;
		name: string;
		description: string;
		visibility: 'all' | 'guild' | 'staff';
		staffOnlyThreads: boolean;
		threads: number;
		lastPostAt: string | null;
		unread: boolean;
	};

	let { boards }: { boards: Board[] } = $props();
</script>

<ul class="boards">
	{#each boards as b (b.id)}
		<li class:unread={b.unread}>
			<a href="/bacheche/{b.id}">
				<span class="name">
					{b.name}
					{#if b.unread}<span class="new">novità</span>{/if}
					{#if b.visibility === 'staff'}<span class="badge danger">staff</span>{/if}
					{#if b.staffOnlyThreads}<span class="badge">discussioni dello staff</span>{/if}
				</span>
				{#if b.description}<span class="muted desc">{b.description}</span>{/if}
				<span class="muted small">
					{b.threads} discussion{b.threads === 1 ? 'e' : 'i'}
					{#if b.lastPostAt}· ultimo messaggio {formatDateTime(b.lastPostAt)}{/if}
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.boards {
		list-style: none;
		padding: 0;
		margin: 0 0 2rem;
		display: grid;
		gap: 0.5rem;
	}
	a {
		display: grid;
		gap: 0.15rem;
		padding: 0.8rem 1rem;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--text);
	}
	a:hover {
		border-color: var(--accent);
	}
	.unread a {
		border-left: 3px solid var(--accent);
	}
	.name {
		font-weight: 600;
		font-size: 1.05rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.new {
		font-size: 0.72rem;
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 999px;
		padding: 0 0.5rem;
		font-weight: 700;
	}
	.badge {
		margin: 0;
	}
	.desc {
		font-size: 0.95rem;
	}
	.small {
		font-size: 0.82rem;
	}
</style>
