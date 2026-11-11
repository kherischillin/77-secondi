<script lang="ts">
	import type { PageProps } from './$types';
	import ChatRoom from '#lib/components/ChatRoom.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{data.location.name} · {data.siteName}</title></svelte:head>

<div class="head">
	<div>
		{#if data.map}<a class="back" href="/gioco/mappa/{data.map.id}">← {data.map.name}</a>{/if}
		<h1>{data.location.name}</h1>
	</div>
</div>

{#if data.location.description || data.location.imageUrl}
	<details class="description card" open>
		<summary>Descrizione del luogo</summary>
		<div class="desc-body">
			{#if data.location.imageUrl}<img src={data.location.imageUrl} alt="" />{/if}
			{#if data.location.description}<p>{data.location.description}</p>{/if}
		</div>
	</details>
{/if}

{#key data.location.id}
	<ChatRoom
		locationId={data.location.id}
		me={data.me}
		initialMessages={data.history.messages}
		initialHasMore={data.history.hasMore}
		initialPresent={data.present}
		can={data.can}
	/>
{/key}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
	}
	.back {
		font-size: 0.9rem;
		text-decoration: none;
	}
	h1 {
		margin-bottom: 0.75rem;
	}
	.description {
		margin-bottom: 1.25rem;
		padding: 0.75rem 1rem;
	}
	summary {
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.desc-body {
		display: flex;
		gap: 1rem;
		margin-top: 0.75rem;
		align-items: flex-start;
	}
	.desc-body img {
		width: 180px;
		max-width: 35%;
		border-radius: var(--radius);
		object-fit: cover;
	}
	.desc-body p {
		margin: 0;
		white-space: pre-line;
	}
	@media (max-width: 600px) {
		.desc-body {
			flex-direction: column;
		}
		.desc-body img {
			width: 100%;
			max-width: 100%;
		}
	}
</style>
