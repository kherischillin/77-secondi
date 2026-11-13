<script lang="ts">
	import Avatar from './Avatar.svelte';

	/**
	 * Campo "nome del personaggio" con suggerimenti: scrivendo "Ad" compare "Adam Smasher", da scegliere
	 * con il mouse o con frecce e Invio. Il valore inviato resta il testo del campo (`name`).
	 */
	let {
		id,
		name,
		value = $bindable(''),
		placeholder = '',
		required = false,
		label = 'Nome del personaggio'
	}: { id: string; name: string; value?: string; placeholder?: string; required?: boolean; label?: string } = $props();

	type Suggestion = { id: number; name: string; avatarUrl: string | null };
	let suggestions = $state<Suggestion[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let requestNo = 0;
	const listId = $derived(`${id}-suggerimenti`);

	async function search(q: string) {
		const mine = ++requestNo;
		if (!q.trim()) {
			suggestions = [];
			open = false;
			return;
		}
		try {
			const res = await fetch(`/personaggi/cerca?q=${encodeURIComponent(q.trim())}`);
			if (!res.ok || mine !== requestNo) return;
			suggestions = await res.json();
			// Nessun menu se l'unico suggerimento è già quello scritto.
			open = suggestions.length > 0 && !(suggestions.length === 1 && suggestions[0].name.toLowerCase() === q.trim().toLowerCase());
			active = -1;
		} catch {
			/* senza rete restano solo il testo scritto e la verifica del server */
		}
	}

	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(() => search(value), 150);
	}

	function choose(s: Suggestion) {
		value = s.name;
		open = false;
		suggestions = [];
	}

	function onkeydown(e: KeyboardEvent) {
		if (!open) {
			if (e.key === 'ArrowDown' && suggestions.length) open = true;
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = (active + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = (active - 1 + suggestions.length) % suggestions.length;
		} else if (e.key === 'Enter' && active >= 0) {
			e.preventDefault();
			choose(suggestions[active]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="picker">
	<input
		{id}
		{name}
		type="text"
		maxlength="80"
		autocomplete="off"
		role="combobox"
		aria-label={label}
		aria-autocomplete="list"
		aria-expanded={open}
		aria-controls={listId}
		aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
		{placeholder}
		{required}
		bind:value
		{oninput}
		{onkeydown}
		onblur={() => setTimeout(() => (open = false), 120)}
		onfocus={() => value.trim() && search(value)}
	/>
	{#if open}
		<ul id={listId} role="listbox" class="suggestions">
			{#each suggestions as s, i (s.id)}
				<li id="{listId}-{i}" role="option" aria-selected={i === active} class:active={i === active}>
					<button type="button" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={() => choose(s)}>
						<Avatar src={s.avatarUrl} name={s.name} size={22} />
						<span>{s.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.picker {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.picker input {
		width: 100%;
	}
	.suggestions {
		position: absolute;
		z-index: 20;
		top: calc(100% + 2px);
		left: 0;
		right: 0;
		list-style: none;
		margin: 0;
		padding: 0.25rem;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		max-height: 16rem;
		overflow-y: auto;
	}
	.suggestions button {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		width: 100%;
		min-height: 0;
		box-shadow: none;
		padding: 0.4rem 0.5rem;
		border: 0;
		border-radius: calc(var(--radius) - 2px);
		background: none;
		color: var(--text);
		font: inherit;
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		text-align: left;
		cursor: pointer;
	}
	.suggestions li.active button,
	.suggestions button:hover {
		background: var(--bg-sunken);
		color: var(--accent);
	}
</style>
