<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? ((form.errors as Record<string, string>) ?? {}) : {});
	const rowMsg = (id: number) => (form && 'id' in form && form.id === id ? form : null);
	let confirmDelete = $state<number | null>(null);
	const every = $derived(data.intervalHours === 24 ? 'al giorno' : `ogni ${data.intervalHours} ore`);
</script>

<svelte:head><title>Lavori · Gestione</title></svelte:head>

<h1>Lavori</h1>
<p class="muted intro">
	Lavori liberi che i giocatori scelgono da <a href="/lavori">Uffici → Lavori</a>: diventano l'occupazione nella scheda e
	danno una paga {every} (l'intervallo è quello degli stipendi, in <a href="/gestione/economia">Economia</a>), ritirata in Banca.
	Un lavoro <strong>chiuso</strong> non si può più scegliere, ma chi lo fa già lo conserva con la sua paga.
</p>

{#if form && 'success' in form && (form.action === 'crea' || form.action === 'elimina')}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form && form.action === 'elimina'}<div class="alert error">{form.error}</div>{/if}

<section class="card new">
	<h2>Nuovo lavoro</h2>
	<form method="post" action="?/crea" class="stack" use:enhance>
		<div class="fields">
			<div class="grow">
				<label for="name">Nome</label>
				<input id="name" name="name" type="text" maxlength="60" required placeholder="es. Fattorino/a" />
				{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
			</div>
			<div>
				<label for="pay">Paga ({data.currency})</label>
				<input id="pay" name="pay" type="number" min="0" required value="0" />
				{#if errors.pay}<p class="field-error">{errors.pay}</p>{/if}
			</div>
			<div>
				<label for="sortOrder">Ordine</label>
				<input id="sortOrder" name="sortOrder" type="number" value={data.jobs.length + 1} />
			</div>
		</div>
		<div>
			<label for="description">Descrizione</label>
			<textarea id="description" name="description" rows="2" maxlength="1000"></textarea>
			{#if errors.description}<p class="field-error">{errors.description}</p>{/if}
		</div>
		<label class="checkbox"><input type="checkbox" name="isOpen" checked /><span>Aperto (si può scegliere)</span></label>
		<div><button type="submit">Crea il lavoro</button></div>
	</form>
</section>

{#if data.jobs.length === 0}
	<p class="muted">Nessun lavoro.</p>
{:else}
	<ul class="jobs">
		{#each data.jobs as j (j.id)}
			{@const m = rowMsg(j.id)}
			<li class="card" class:closed={!j.isOpen}>
				<form method="post" action="?/modifica" class="stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
					<input type="hidden" name="id" value={j.id} />
					<div class="fields">
						<div class="grow">
							<label for="name-{j.id}">Nome</label>
							<input id="name-{j.id}" name="name" type="text" maxlength="60" required value={j.name} />
						</div>
						<div>
							<label for="pay-{j.id}">Paga</label>
							<input id="pay-{j.id}" name="pay" type="number" min="0" required value={j.pay} />
						</div>
						<div>
							<label for="sort-{j.id}">Ordine</label>
							<input id="sort-{j.id}" name="sortOrder" type="number" value={j.sortOrder} />
						</div>
					</div>
					<div>
						<label for="desc-{j.id}">Descrizione</label>
						<textarea id="desc-{j.id}" name="description" rows="2" maxlength="1000">{j.description}</textarea>
					</div>
					<div class="foot">
						<label class="checkbox"><input type="checkbox" name="isOpen" checked={j.isOpen} /><span>Aperto</span></label>
						<span class="muted small">{j.workers === 0 ? 'Nessuno lo fa' : j.workers === 1 ? '1 personaggio lo fa' : `${j.workers} personaggi lo fanno`}</span>
						<span class="spacer"></span>
						<button type="submit">Salva</button>
						{#if confirmDelete === j.id}
							<button type="submit" formaction="?/elimina" class="danger">Sì, cancella</button>
							<button type="button" class="link small" onclick={() => (confirmDelete = null)}>Annulla</button>
						{:else}
							<button type="button" class="secondary" onclick={() => (confirmDelete = j.id)}>Cancella</button>
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
		width: 8rem;
	}
	.fields > .grow {
		flex: 1;
		min-width: 14rem;
	}
	.jobs {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 1rem;
	}
	.jobs li.closed {
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
