<script lang="ts">
	import { enhance } from '$app/forms';
	import { splitSpeech, type ChatMessageView } from '#lib/chat.ts';
	import ReportButton from './ReportButton.svelte';

	let {
		message,
		me,
		canModerate = false,
		reportable = false
	}: { message: ChatMessageView; me: number; canModerate?: boolean; reportable?: boolean } = $props();

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
		{:else if message.kind === 'check'}
			<span class="who">{message.characterName ?? 'Qualcuno'}</span><span class="muted">fa una prova</span>
		{:else if message.kind === 'item'}
			<a class="who" href="/scheda/{message.characterId}" target="_blank">{message.characterName ?? 'Qualcuno'}</a>
			<span class="muted">{message.meta?.item?.consumed ? 'usa' : 'mostra'}</span>
			<span class="item-name">{message.meta?.item?.name ?? 'un oggetto'}</span>
		{:else if message.kind === 'system'}
			<span class="system-label">Quest</span>
		{:else if message.characterId}
			<a class="who" href="/scheda/{message.characterId}" target="_blank">{message.characterName ?? 'Qualcuno'}</a>
		{:else}
			<span class="who">{message.characterName ?? 'Qualcuno'}</span>
		{/if}

		{#if message.hidden}<span class="badge danger">nascosto</span>{/if}

		{#if reportable && message.characterId !== me && message.kind !== 'system' && !message.hidden}
			<span class="report-slot"><ReportButton targetType="chat_message" targetId={message.id} /></span>
		{/if}
		{#if canModerate}
			<form method="post" action={message.hidden ? '?/ripristina' : '?/nascondi'} class="mod" use:enhance={() => async () => {}}>
				<input type="hidden" name="id" value={message.id} />
				<button type="submit" class="link">{message.hidden ? 'Ripristina' : 'Nascondi'}</button>
			</form>
		{/if}
	</header>

	{#if message.kind === 'check' && message.meta?.check}
		{@const c = message.meta.check}
		<p class="body roll">
			<span class="expr">{c.skill?.name ?? c.stat?.name}</span>
			<span class="rolls">
				d{c.die}: {c.roll}{#if c.stat}{' + '}{c.stat.name} {c.stat.value}{/if}{#if c.skill}{' + '}rango {c.skill.rank}{/if}{#if c.bonus?.value}<span title={c.bonus.sources.join(', ')}>{c.bonus.value > 0 ? ' + ' : ' − '}oggetti {Math.abs(c.bonus.value)}</span>{/if}
			</span>
			<span class="total">= {c.total}</span>
			{#if c.natural === 'max'}<span class="badge accent">massimo naturale</span>{/if}
			{#if c.natural === 'min'}<span class="badge danger">minimo naturale</span>{/if}
		</p>
	{:else if message.kind === 'dice' && message.meta?.dice}
		<p class="body roll">
			<span class="expr">{message.meta.dice.expression}</span>
			<span class="rolls">{message.meta.dice.rolls.join(' + ')}{#if message.meta.dice.modifier}{' '}({message.meta.dice.modifier > 0 ? '+' : ''}{message.meta.dice.modifier}){/if}</span>
			<span class="total">= {message.meta.dice.total}</span>
		</p>
	{:else if message.kind === 'item'}
		{#if message.body}
			<p class="body">
				{#each segments as s, i (i)}{#if s.speech}<q>{s.text}</q>{:else}{s.text}{/if}{/each}
			</p>
		{/if}
		{#if message.meta?.item?.description}<p class="item-desc">{message.meta.item.description}</p>{/if}
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
		color: var(--c-tag);
		font-weight: 600;
		letter-spacing: 0.03em;
	}
	.who {
		font-weight: 700;
		color: var(--accent);
		text-decoration: none;
	}
	a.who:hover {
		text-decoration: underline;
	}
	.body {
		margin: 0.15rem 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	q {
		quotes: none;
		color: var(--c-speech);
		font-style: italic;
	}
	.mine {
		background: color-mix(in srgb, var(--accent) 5%, transparent);
	}

	/* Master: la stringa del GM è vincolante, deve risaltare. */
	.master {
		border-left-color: var(--c-master);
		background: color-mix(in srgb, var(--c-master) 10%, transparent);
	}
	.master-label {
		color: var(--c-master-text);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.master .body {
		font-family: var(--font-title);
		font-size: 1.05rem;
	}

	.npc {
		border-left-color: var(--c-npc);
	}
	.npc .who {
		color: var(--c-npc-text);
	}
	.png {
		font-size: 0.7rem;
		border: 1px solid var(--c-npc);
		color: var(--c-npc-text);
		border-radius: 999px;
		padding: 0 0.4rem;
	}

	.whisper {
		border-left-color: var(--c-whisper);
		background: color-mix(in srgb, var(--c-whisper) 10%, transparent);
	}
	.whisper .body {
		font-style: italic;
		color: var(--c-whisper-text);
	}
	.whisper .who {
		color: var(--c-whisper-strong);
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

	.check {
		border-left-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 7%, transparent);
	}
	.item {
		border-left-color: var(--c-item);
		background: color-mix(in srgb, var(--c-item) 8%, transparent);
	}
	.item-name {
		font-weight: 700;
		color: var(--c-positive);
	}
	.item-desc {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
		color: var(--text-muted);
		font-style: italic;
	}
	.system {
		border-left-color: var(--c-system);
		background: color-mix(in srgb, var(--c-system) 12%, transparent);
		text-align: center;
	}
	.system header {
		justify-content: center;
	}
	.system .body {
		font-family: var(--font-title);
		font-size: 1.05rem;
	}
	.system-label {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--c-system-text);
		font-weight: 700;
	}

	.hidden {
		opacity: 0.5;
	}
	.mod {
		margin-left: auto;
	}
	.report-slot {
		margin-left: auto;
	}
	.report-slot + .mod {
		margin-left: 0.5rem;
	}
	.mod button {
		font-size: 0.8rem;
	}
</style>
