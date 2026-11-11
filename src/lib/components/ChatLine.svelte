<script lang="ts">
	import { enhance } from '$app/forms';
	import { splitSpeech, type ChatMessageView } from '#lib/chat.ts';

	let {
		message,
		me,
		canModerate = false
	}: { message: ChatMessageView; me: number; canModerate?: boolean } = $props();

	const time = $derived(
		new Date(message.createdAt).toLocaleTimeString('it-IT', {
			timeZone: 'Europe/Rome',
			hour: '2-digit',
			minute: '2-digit'
		})
	);
	const segments = $derived(splitSpeech(message.body));
</script>

<article class="line {message.kind}" class:hidden={message.hidden} class:mine={message.characterId === me}>
	<header>
		<time datetime={message.createdAt}>{time}</time>
		{#if message.tag}<span class="tag">[{message.tag}]</span>{/if}

		{#if message.kind === 'master'}
			<span class="who master-label">Master</span>
		{:else if message.kind === 'npc'}
			<span class="who">{message.npcName}</span><span class="png">PNG</span>
		{:else if message.kind === 'whisper'}
			<span class="who">{message.characterName ?? 'Qualcuno'}</span>
			<span class="muted">sussurra a</span>
			<span class="who">{message.recipientName ?? 'qualcuno'}</span>
		{:else if message.kind === 'dice'}
			<span class="who">{message.characterName ?? 'Qualcuno'}</span><span class="muted">tira i dadi</span>
		{:else}
			<span class="who">{message.characterName ?? 'Qualcuno'}</span>
		{/if}

		{#if message.hidden}<span class="badge danger">nascosto</span>{/if}

		{#if canModerate}
			<form method="post" action={message.hidden ? '?/ripristina' : '?/nascondi'} class="mod" use:enhance={() => async () => {}}>
				<input type="hidden" name="id" value={message.id} />
				<button type="submit" class="link">{message.hidden ? 'Ripristina' : 'Nascondi'}</button>
			</form>
		{/if}
	</header>

	{#if message.kind === 'dice' && message.meta?.dice}
		<p class="body roll">
			<span class="expr">{message.meta.dice.expression}</span>
			<span class="rolls">{message.meta.dice.rolls.join(' + ')}{#if message.meta.dice.modifier}{' '}({message.meta.dice.modifier > 0 ? '+' : ''}{message.meta.dice.modifier}){/if}</span>
			<span class="total">= {message.meta.dice.total}</span>
		</p>
	{:else}
		<p class="body">
			{#each segments as s, i (i)}{#if s.speech}<q>{s.text}</q>{:else}{s.text}{/if}{/each}
		</p>
	{/if}
</article>

<style>
	.line {
		padding: 0.55rem 0.75rem;
		border-left: 3px solid transparent;
		border-radius: 4px;
		margin-bottom: 0.25rem;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.15rem 0.45rem;
		font-size: 0.85rem;
	}
	time {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		font-size: 0.8rem;
	}
	.tag {
		color: #b9a8d9;
		font-weight: 600;
		letter-spacing: 0.03em;
	}
	.who {
		font-weight: 700;
		color: var(--accent);
	}
	.body {
		margin: 0.15rem 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	q {
		quotes: none;
		color: #f3e2bf;
		font-style: italic;
	}
	.mine {
		background: rgba(212, 162, 76, 0.05);
	}

	/* Master: la stringa del GM è vincolante, deve risaltare. */
	.master {
		border-left-color: #c0504d;
		background: rgba(192, 80, 77, 0.1);
	}
	.master-label {
		color: #e58c88;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.master .body {
		font-family: var(--font-title);
		font-size: 1.05rem;
	}

	.npc {
		border-left-color: #6f9b6a;
	}
	.npc .who {
		color: #a8cf9f;
	}
	.png {
		font-size: 0.7rem;
		border: 1px solid #6f9b6a;
		color: #a8cf9f;
		border-radius: 999px;
		padding: 0 0.4rem;
	}

	.whisper {
		border-left-color: #5d7fa8;
		background: rgba(93, 127, 168, 0.1);
	}
	.whisper .body {
		font-style: italic;
		color: #c7d6ea;
	}
	.whisper .who {
		color: #9cbbe0;
	}

	.roll {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.roll .expr {
		font-weight: 700;
		color: var(--text-muted);
	}
	.roll .total {
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--accent-strong);
	}

	.hidden {
		opacity: 0.5;
	}
	.mod {
		margin-left: auto;
	}
	.mod button {
		font-size: 0.8rem;
	}
</style>
