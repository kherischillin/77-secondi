<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import JobIcon from '#lib/components/JobIcon.svelte';
	import { JOB_ICON_KEYS, JOB_ICONS } from '#lib/job-icons.ts';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? ((form.errors as Record<string, string>) ?? {}) : {});
	const rowMsg = (id: number) => (form && 'id' in form && form.id === id ? form : null);
	let confirmDelete = $state<number | null>(null);
</script>

<svelte:head><title>Negozi · Gestione</title></svelte:head>

<h1>Negozi</h1>
<p class="muted intro">
	I negozi del <a href="/mercato">mercato</a>: ognuno vende i suoi oggetti. Per mettere un oggetto in un negozio, aprilo in
	<a href="/gestione/oggetti">Oggetti e mercato</a> e scegli il negozio. Un negozio <strong>chiuso</strong> sparisce dal mercato;
	uno <strong>cancellato</strong> lascia i suoi oggetti tra gli «Altri articoli».
</p>

{#if form && 'success' in form && (form.action === 'crea' || form.action === 'elimina')}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form && form.action === 'elimina'}<div class="alert error">{form.error}</div>{/if}

{#snippet iconPicker(selected: string)}
	<fieldset class="icons">
		<legend>Icona</legend>
		{#each JOB_ICON_KEYS as k (k)}
			<label class="icon-opt" title={JOB_ICONS[k].label}>
				<input type="radio" name="icon" value={k} checked={selected === k} />
				<JobIcon icon={k} size={22} />
				<span class="visually-hidden">{JOB_ICONS[k].label}</span>
			</label>
		{/each}
	</fieldset>
{/snippet}

<section class="card new">
	<h2>Nuovo negozio</h2>
	<form method="post" action="?/crea" class="stack" use:enhance>
		<div class="fields">
			<div class="grow">
				<label for="name">Nome</label>
				<input id="name" name="name" type="text" maxlength="60" required placeholder="es. Arsenale del Vecchio Lupo" />
				{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
			</div>
			<div class="grow">
				<label for="tagline">Cosa vende <span class="hint">in poche parole</span></label>
				<input id="tagline" name="tagline" type="text" maxlength="60" placeholder="es. Armi e munizioni" />
			</div>
			<div>
				<label for="sortOrder">Ordine</label>
				<input id="sortOrder" name="sortOrder" type="number" value={data.shops.length + 1} />
			</div>
		</div>
		{@render iconPicker('stall')}
		<div>
			<label for="description">Descrizione</label>
			<textarea id="description" name="description" rows="2" maxlength="1000"></textarea>
		</div>
		<label class="checkbox"><input type="checkbox" name="isOpen" checked /><span>Aperto</span></label>
		<div><button type="submit">Crea il negozio</button></div>
	</form>
</section>

{#if data.shops.length === 0}
	<p class="muted">Nessun negozio.</p>
{:else}
	<ul class="shops">
		{#each data.shops as s (s.id)}
			{@const m = rowMsg(s.id)}
			<li class="card" class:closed={!s.isOpen}>
				<form method="post" action="?/modifica" class="stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
					<input type="hidden" name="id" value={s.id} />
					<div class="fields">
						<div class="grow">
							<label for="name-{s.id}">Nome</label>
							<input id="name-{s.id}" name="name" type="text" maxlength="60" required value={s.name} />
						</div>
						<div class="grow">
							<label for="tagline-{s.id}">Cosa vende</label>
							<input id="tagline-{s.id}" name="tagline" type="text" maxlength="60" value={s.tagline} />
						</div>
						<div>
							<label for="sort-{s.id}">Ordine</label>
							<input id="sort-{s.id}" name="sortOrder" type="number" value={s.sortOrder} />
						</div>
					</div>
					{@render iconPicker(s.icon)}
					<div>
						<label for="desc-{s.id}">Descrizione</label>
						<textarea id="desc-{s.id}" name="description" rows="2" maxlength="1000">{s.description}</textarea>
					</div>
					<div class="foot">
						<label class="checkbox"><input type="checkbox" name="isOpen" checked={s.isOpen} /><span>Aperto</span></label>
						<span class="muted small">{s.wares === 1 ? '1 oggetto in vendita' : `${s.wares} oggetti in vendita`}</span>
						<span class="spacer"></span>
						<button type="submit">Salva</button>
						{#if confirmDelete === s.id}
							<button type="submit" formaction="?/elimina" class="danger">Sì, cancella</button>
							<button type="button" class="link small" onclick={() => (confirmDelete = null)}>Annulla</button>
						{:else}
							<button type="button" class="secondary" onclick={() => (confirmDelete = s.id)}>Cancella</button>
						{/if}
					</div>
					{#if m && 'success' in m}<p class="ok small">{m.success}</p>{/if}
					{#if m && 'error' in m}<p class="field-error">{m.error}</p>{/if}
				</form>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.intro {
		max-width: 75ch;
	}
	.new {
		margin-bottom: 1.5rem;
	}
	.new h2 {
		margin-top: 0;
	}
	.fields {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.fields > div {
		width: 7rem;
	}
	.fields > .grow {
		flex: 1;
		min-width: 13rem;
	}
	.icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		border: 0;
		padding: 0;
		margin: 0;
	}
	.icons legend {
		font-weight: 600;
		margin-bottom: 0.3rem;
		padding: 0;
	}
	.icon-opt {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		margin: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.icon-opt input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	.icon-opt .visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.icon-opt:has(input:checked) {
		border-color: var(--accent);
		background: var(--bg-sunken);
	}
	.icon-opt:has(input:focus-visible) {
		outline: 2px solid var(--focus);
	}
	.shops {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 1rem;
	}
	.shops li.closed {
		opacity: 0.7;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.foot .checkbox {
		margin: 0;
	}
	.spacer {
		flex: 1;
	}
	.ok {
		color: var(--success);
		margin: 0;
	}
</style>
