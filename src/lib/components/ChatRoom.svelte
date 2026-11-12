<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import ChatLine from './ChatLine.svelte';
	import Avatar from './Avatar.svelte';
	import JobIcon from './JobIcon.svelte';
	import { MAX_MESSAGE_LENGTH, timeAgo, type ChatMessageView, type ChosenKind } from '#lib/chat.ts';
	import { fullName } from '#lib/format.ts';
	import { page } from '$app/state';
	import { playTone } from '#lib/sound.ts';

	type Present = { characterId: number; name: string; surname: string | null; avatarUrl: string | null; jobName?: string | null; jobIcon?: string | null; lastPostAt: string | null };

	let {
		locationId,
		me,
		initialMessages,
		initialHasMore,
		initialPresent,
		can,
		quest,
		questDie,
		diceAllowed,
		statsAllocated,
		checkOptions
	}: {
		locationId: number;
		me: number;
		initialMessages: ChatMessageView[];
		initialHasMore: boolean;
		initialPresent: Present[];
		can: { master: boolean; npc: boolean; moderate: boolean };
		quest: { id: number; title: string; masterName: string | null } | null;
		questDie: number;
		diceAllowed: boolean;
		statsAllocated: boolean;
		checkOptions: { stats: { id: number; name: string }[]; skills: { id: number; name: string }[] };
	} = $props();

	let checkTarget = $state('');
	let checking = $state(false);
	let checkError = $state('');

	// Il componente viene ricreato a ogni cambio di luogo, quindi i valori iniziali si leggono una volta.
	// svelte-ignore state_referenced_locally
	let messages = $state<ChatMessageView[]>(initialMessages);
	// svelte-ignore state_referenced_locally
	let hasMore = $state(initialHasMore);
	// svelte-ignore state_referenced_locally
	let present = $state<Present[]>(initialPresent);

	let status = $state<'connecting' | 'online' | 'reconnecting'>('connecting');
	let now = $state(Date.now());

	let kind = $state<ChosenKind>('action');
	let text = $state('');
	let tag = $state('');
	let npcName = $state('');
	let recipient = $state('');
	let sending = $state(false);
	let sendError = $state('');
	let loadingOlder = $state(false);

	let log: HTMLDivElement;
	let form: HTMLFormElement;
	let input: HTMLTextAreaElement;

	const others = $derived(present.filter((p) => p.characterId !== me));

	function nearBottom() {
		return !log || log.scrollHeight - log.scrollTop - log.clientHeight < 120;
	}

	async function scrollToBottom() {
		await tick();
		if (log) log.scrollTop = log.scrollHeight;
	}

	function addMessage(m: ChatMessageView) {
		if (messages.some((x) => x.id === m.id)) return;
		// Avvisi sonori scelti in Impostazioni → Notifiche (mai per i propri messaggi).
		const notify = page.data.notify as { soundWhisper?: boolean; soundMaster?: boolean } | undefined;
		if (m.characterId !== me) {
			if (m.kind === 'whisper' && m.recipientCharacterId === me && notify?.soundWhisper) playTone('whisper');
			else if ((m.kind === 'master' || m.kind === 'npc') && notify?.soundMaster) playTone('master');
		}
		const stick = nearBottom() || m.characterId === me;
		messages = [...messages, m].sort((a, b) => a.id - b.id);
		if (stick) scrollToBottom();
	}

	async function loadOlder() {
		if (!messages.length || loadingOlder) return;
		loadingOlder = true;
		try {
			const res = await fetch(`/gioco/luogo/${locationId}/storico?prima=${messages[0].id}`);
			if (!res.ok) return;
			const data: { messages: ChatMessageView[]; hasMore: boolean } = await res.json();
			const previousHeight = log.scrollHeight;
			const known = new Set(messages.map((m) => m.id));
			messages = [...data.messages.filter((m) => !known.has(m.id)), ...messages];
			hasMore = data.hasMore;
			await tick();
			log.scrollTop = log.scrollHeight - previousHeight;
		} finally {
			loadingOlder = false;
		}
	}

	onMount(() => {
		scrollToBottom();
		const source = new EventSource(`/gioco/luogo/${locationId}/eventi`);

		source.addEventListener('ready', () => (status = 'online'));
		source.addEventListener('error', () => (status = 'reconnecting'));
		source.addEventListener('message', (e) => addMessage(JSON.parse(e.data)));
		source.addEventListener('update', (e) => {
			const m: ChatMessageView = JSON.parse(e.data);
			messages = messages.map((x) => (x.id === m.id ? m : x));
		});
		source.addEventListener('remove', (e) => {
			const { id } = JSON.parse(e.data);
			messages = messages.filter((x) => x.id !== id);
		});
		source.addEventListener('presence', (e) => (present = JSON.parse(e.data)));
		source.addEventListener('location', () => invalidateAll());
		source.addEventListener('quest', () => invalidateAll());
		// Stanza privata: l'accesso è cambiato, si ricontrolla chi può restare.
		source.addEventListener('closed', () => {
			source.close();
			invalidateAll();
		});

		const clock = setInterval(() => (now = Date.now()), 30_000);
		return () => {
			source.close();
			clearInterval(clock);
		};
	});

	function onKeydown(e: KeyboardEvent) {
		// Invio manda il messaggio, Maiusc+Invio va a capo.
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			if (text.trim() && !sending) form.requestSubmit();
		}
	}

	function whisperTo(p: Present) {
		kind = 'whisper';
		recipient = p.name;
		input?.focus();
	}
</script>

<div class="room">
	<section class="chat" aria-label="Chat del luogo">
		<div class="status" data-status={status}>
			{#if status === 'online'}In diretta{:else if status === 'connecting'}Connessione…{:else}Riconnessione in corso…{/if}
		</div>

		<div class="log" bind:this={log} aria-live="polite">
			{#if hasMore}
				<div class="older">
					<button type="button" class="secondary" onclick={loadOlder} disabled={loadingOlder}>
						{loadingOlder ? 'Caricamento…' : 'Carica messaggi precedenti'}
					</button>
				</div>
			{/if}
			{#each messages as m (m.id)}
				<ChatLine message={m} {me} canModerate={can.moderate} reportable />
			{:else}
				<p class="empty muted">Nessun messaggio recente. Sii il primo a dare vita a questo luogo.</p>
			{/each}
		</div>

		{#if quest}
			<form
				method="post"
				action="?/prova"
				class="check card"
				use:enhance={() => {
					checking = true;
					checkError = '';
					return async ({ result }) => {
						checking = false;
						if (result.type === 'failure') checkError = String(result.data?.error ?? 'Prova non riuscita.');
						else if (result.type === 'error') checkError = 'Prova non riuscita. Riprova.';
					};
				}}
			>
				<span class="check-title">Prova <span class="muted">d{questDie}</span></span>
				{#if !statsAllocated}
					<span class="muted small">Per fare le prove distribuisci prima i punti nella <a href="/scheda/{me}" target="_blank">tua scheda</a>.</span>
				{:else}
					<label class="grow">
						<span class="visually-hidden">Abilità o caratteristica</span>
						<select name="target" bind:value={checkTarget} required>
							<option value="">Scegli abilità o caratteristica…</option>
							{#if checkOptions.skills.length}
								<optgroup label="Abilità">
									{#each checkOptions.skills as s (s.id)}<option value="skill:{s.id}">{s.name}</option>{/each}
								</optgroup>
							{/if}
							<optgroup label="Caratteristiche">
								{#each checkOptions.stats as s (s.id)}<option value="stat:{s.id}">{s.name}</option>{/each}
							</optgroup>
						</select>
					</label>
					<button type="submit" disabled={checking || !checkTarget}>{checking ? 'Tiro…' : 'Tira'}</button>
				{/if}
				{#if checkError}<p class="field-error full" role="alert">{checkError}</p>{/if}
			</form>
		{/if}

		<form
			method="post"
			action="?/invia"
			class="composer"
			bind:this={form}
			use:enhance={() => {
				sending = true;
				sendError = '';
				return async ({ result }) => {
					sending = false;
					if (result.type === 'success') {
						text = '';
						input?.focus();
					} else if (result.type === 'failure') {
						sendError = String(result.data?.error ?? 'Invio non riuscito.');
					} else if (result.type === 'redirect') {
						location.href = result.location;
					} else {
						sendError = 'Invio non riuscito. Riprova.';
					}
				};
			}}
		>
			<div class="options">
				<label>
					<span class="visually-hidden">Tipo di intervento</span>
					<select name="kind" bind:value={kind}>
						<option value="action">Azione</option>
						<option value="whisper">Sussurro</option>
						{#if can.master}<option value="master">Master</option>{/if}
						{#if can.npc}<option value="npc">PNG</option>{/if}
					</select>
				</label>

				{#if kind === 'whisper'}
					<label>
						<span class="visually-hidden">Destinatario</span>
						<select name="recipient" bind:value={recipient}>
							<option value="">A chi?</option>
							{#each others as p (p.characterId)}
								<option value={p.name}>{fullName(p)}</option>
							{/each}
						</select>
					</label>
				{:else}
					<label>
						<span class="visually-hidden">Tag di posizione</span>
						<input name="tag" type="text" maxlength="40" placeholder="Tag (es. TAVOLO VERDE)" bind:value={tag} />
					</label>
				{/if}

				{#if kind === 'npc'}
					<label>
						<span class="visually-hidden">Nome del PNG</span>
						<input name="npcName" type="text" maxlength="40" placeholder="Nome del PNG" bind:value={npcName} required />
					</label>
				{/if}
			</div>

			<label class="text">
				<span class="visually-hidden">Messaggio</span>
				<textarea
					name="text"
					bind:this={input}
					bind:value={text}
					onkeydown={onKeydown}
					maxlength={MAX_MESSAGE_LENGTH}
					rows="3"
					placeholder={kind === 'master'
						? 'Stringa del Master…'
						: kind === 'whisper'
							? 'Cosa sussurri?'
							: 'Descrivi l’azione in terza persona. I dialoghi tra «virgolette».'}
				></textarea>
			</label>

			{#if sendError}<p class="field-error" role="alert">{sendError}</p>{/if}

			<div class="actions">
				<span class="muted hint">
					Invio per mandare · Maiusc+Invio per andare a capo · <code>@Nome@</code> sussurro{#if diceAllowed} · <code>#2d6</code> dadi{/if}
				</span>
				<span class="counter muted" class:warn={text.length > MAX_MESSAGE_LENGTH * 0.9}>{text.length}/{MAX_MESSAGE_LENGTH}</span>
				<button type="submit" disabled={sending || !text.trim()}>{sending ? 'Invio…' : 'Invia'}</button>
			</div>
		</form>
	</section>

	<aside class="present card" aria-label="Presenti nel luogo">
		<h2>Presenti <span class="muted">{present.length}</span></h2>
		{#if present.length === 0}
			<p class="muted">Nessuno.</p>
		{:else}
			<ul>
				{#each present as p (p.characterId)}
					<li>
						<Avatar src={p.avatarUrl} name={p.name} size={36} />
						<div class="who-box">
							<span class="name-row">
								<a class="name" class:me={p.characterId === me} href="/scheda/{p.characterId}" target="_blank">{fullName(p)}</a>
								{#if p.jobName}<JobIcon icon={p.jobIcon} title={p.jobName} size={15} />{/if}
							</span>
							<span class="muted small">ultima azione: {timeAgo(p.lastPostAt, now)}</span>
							{#if p.characterId !== me}
								<button type="button" class="link small" onclick={() => whisperTo(p)}>sussurra</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>
</div>

<style>
	.room {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 260px;
		gap: 1.25rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.room {
			grid-template-columns: 1fr;
		}
		.present {
			order: -1;
		}
	}
	.chat {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.status {
		font-size: 0.8rem;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.status::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #a0a0a0;
	}
	.status[data-status='online']::before {
		background: var(--success);
	}
	.status[data-status='reconnecting']::before {
		background: var(--danger);
	}
	.log {
		height: min(62vh, 680px);
		min-height: 280px;
		overflow-y: auto;
		background: var(--bg-sunken);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.5rem;
		overscroll-behavior: contain;
	}
	.older {
		text-align: center;
		margin-bottom: 0.5rem;
	}
	.empty {
		text-align: center;
		margin-top: 2rem;
	}
	.composer {
		display: grid;
		gap: 0.5rem;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.options label {
		margin: 0;
		flex: 1 1 160px;
	}
	.options select {
		min-width: 0;
	}
	.text {
		margin: 0;
	}
	textarea {
		min-height: 84px;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.hint {
		font-size: 0.8rem;
		margin-right: auto;
	}
	.counter {
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}
	.counter.warn {
		color: var(--danger);
	}
	.present h2 {
		font-size: 1.2rem;
	}
	.present ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.present li {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border);
	}
	.who-box {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.5rem;
		min-width: 0;
	}
	.name {
		font-weight: 600;
		width: 100%;
		color: var(--text);
		text-decoration: none;
	}
	.name:hover {
		color: var(--accent);
	}
	.check {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		padding: 0.75rem 1rem;
		border-color: var(--accent);
	}
	.check-title {
		font-family: var(--font-title);
		font-weight: 600;
	}
	.check .grow {
		flex: 1 1 220px;
		margin: 0;
	}
	.check .full {
		width: 100%;
		margin: 0;
	}
	.name.me::after {
		content: ' (tu)';
		color: var(--text-muted);
		font-weight: 400;
	}
	.small {
		font-size: 0.8rem;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.name-row {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
</style>
