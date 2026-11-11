<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import ChatRoom from '#lib/components/ChatRoom.svelte';

	let { data, form }: PageProps = $props();
	let showStart = $state(false);
	let confirmEnd = $state(false);
	const questError = $derived(form && 'questError' in form ? form.questError : '');
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

{#if data.quest}
	<section class="quest-banner" aria-live="polite">
		<div>
			<span class="label">Quest in corso</span>
			<strong>{data.quest.title}</strong>
			{#if data.quest.masterName}<span class="muted"> · Master: {data.quest.masterName}</span>{/if}
			<p class="muted small">Durante la quest valgono le regole numeriche: le prove si tirano dal pannello sotto la chat.</p>
		</div>
		{#if data.can.master}
			{#if !confirmEnd}
				<button type="button" class="secondary" onclick={() => (confirmEnd = true)}>Termina quest</button>
			{:else}
				<form method="post" action="?/terminaQuest" class="row" use:enhance>
					<button type="submit">Conferma fine quest</button>
					<button type="button" class="secondary" onclick={() => (confirmEnd = false)}>Annulla</button>
				</form>
			{/if}
		{/if}
	</section>
{:else if data.can.master}
	<div class="master-tools">
		{#if !showStart}
			<button type="button" class="secondary" onclick={() => (showStart = true)}>Avvia una quest in questo luogo</button>
		{:else}
			<form
				method="post"
				action="?/avviaQuest"
				class="row"
				use:enhance={() => async ({ update }) => {
					await update();
					showStart = false;
				}}
			>
				<label for="questTitle" class="visually-hidden">Titolo della quest</label>
				<input id="questTitle" name="title" type="text" maxlength="100" placeholder="Titolo della quest" required />
				<button type="submit">Avvia</button>
				<button type="button" class="secondary" onclick={() => (showStart = false)}>Annulla</button>
			</form>
		{/if}
	</div>
{/if}
{#if questError}<div class="alert error">{questError}</div>{/if}

{#key data.location.id}
	<ChatRoom
		locationId={data.location.id}
		me={data.me}
		initialMessages={data.history.messages}
		initialHasMore={data.history.hasMore}
		initialPresent={data.present}
		can={data.can}
		quest={data.quest}
		questDie={data.questDie}
		diceAllowed={data.diceAllowed}
		statsAllocated={data.statsAllocated}
		checkOptions={data.checkOptions}
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
	.quest-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		border: 1px solid #8a7bb0;
		background: rgba(138, 123, 176, 0.14);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin-bottom: 1.25rem;
	}
	.quest-banner .label {
		display: block;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: #c6b8ea;
		font-weight: 700;
	}
	.quest-banner p {
		margin: 0.25rem 0 0;
	}
	.small {
		font-size: 0.85rem;
	}
	.master-tools {
		margin-bottom: 1rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.row input {
		flex: 1 1 220px;
		width: auto;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
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
