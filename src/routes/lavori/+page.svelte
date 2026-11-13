<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import EconomyNav from '#lib/components/EconomyNav.svelte';
	import JobIcon from '#lib/components/JobIcon.svelte';
	import { formatDateTime } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	const fmt = (n: number) => n.toLocaleString('it-IT', { useGrouping: 'always' });
	const every = $derived(data.intervalHours === 24 ? 'al giorno' : data.intervalHours % 24 === 0 ? `ogni ${data.intervalHours / 24} giorni` : `ogni ${data.intervalHours} ore`);
	let confirmLeave = $state(false);
</script>

<svelte:head><title>Lavori · {data.siteName}</title></svelte:head>

<h1>Lavori</h1>
<EconomyNav cash={data.purse.money} bank={data.purse.bank} currency={data.currency} />

<p class="muted intro">
	Lavori liberi: mansioni di tutti i giorni, senza regole di gioco, che fanno da sfondo alla vita del personaggio.
	Il lavoro scelto compare come <strong>occupazione</strong> nella scheda e dà una paga {every}, da ritirare in
	<a href="/banca">Banca</a>. Si fa un lavoro alla volta; cambiarlo non fa ripartire il conteggio della paga.
</p>

{#if form && 'success' in form}<div class="alert success">{form.success}</div>{/if}
{#if form && 'error' in form}<div class="alert error">{form.error}</div>{/if}

<section class="card my-job">
	{#if data.guild}
		<p class="in-guild">
			<a href="/gilde/{data.guild.id}"><JobIcon icon={data.guild.icon} size={22} /></a>
			<span>{data.me.name} è <strong>{data.guild.rank}</strong> di <a href="/gilde/{data.guild.id}">{data.guild.name}</a>: chi fa parte di una gilda lavora per lei e non può avere un lavoro libero. Lo stipendio della gilda si ritira in <a href="/banca">Banca</a>.</span>
		</p>
	{:else if data.current}
		<div>
			<span class="label">Lavoro di {data.me.name}</span>
			<strong class="name"><JobIcon icon={data.current.icon} size={22} /> {data.current.name}</strong>
			{#if data.pay}
				<span class="muted small">
					{fmt(data.pay.pay)} {data.currency} {every} ·
					{#if data.pay.ready}<a href="/banca">paga pronta in banca</a>{:else if data.pay.nextAt}prossima paga dal {formatDateTime(data.pay.nextAt)}{/if}
				</span>
			{/if}
		</div>
		<form method="post" action="?/lascia" use:enhance={() => async ({ update }) => { confirmLeave = false; await update(); }}>
			{#if confirmLeave}
				<span class="small">Lasciare il lavoro?</span>
				<button type="submit" class="danger small-btn">Sì, lascialo</button>
				<button type="button" class="link small" onclick={() => (confirmLeave = false)}>Annulla</button>
			{:else}
				<button type="button" class="secondary" onclick={() => (confirmLeave = true)}>Lascia il lavoro</button>
			{/if}
		</form>
	{:else}
		<p class="muted">{data.me.name} non ha ancora un lavoro: scegline uno qui sotto.</p>
	{/if}
</section>

{#if data.jobs.length === 0}
	<p class="muted">Lo staff non ha ancora aperto nessun lavoro.</p>
{:else}
	<ul class="jobs">
		{#each data.jobs as j (j.id)}
			<li class="card" class:mine={data.current?.id === j.id}>
				<div class="info">
					<h2><JobIcon icon={j.icon} size={20} /> {j.name}</h2>
					{#if j.description}<p>{j.description}</p>{/if}
					<p class="muted small">
						Paga: <strong>{fmt(j.pay)} {data.currency}</strong> {every}
						{#if j.workers > 0}· {j.workers === 1 ? '1 persona lo fa' : `${j.workers} persone lo fanno`}{/if}
					</p>
				</div>
				{#if data.current?.id === j.id}
					<span class="badge accent">Il tuo lavoro</span>
				{:else if !data.guild}
					<form method="post" action="?/scegli" use:enhance>
						<input type="hidden" name="jobId" value={j.id} />
						<button type="submit" class={data.current ? 'secondary' : ''}>{data.current ? 'Cambia con questo' : 'Scegli'}</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.intro {
		max-width: 70ch;
	}
	.my-job {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}
	.my-job > div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.my-job p {
		margin: 0;
	}
	.label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
	.name {
		font-size: 1.25rem;
	}
	.my-job form {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.jobs {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}
	.jobs li {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.jobs li.mine {
		border-color: var(--accent);
	}
	.jobs h2 {
		font-size: 1.1rem;
		margin: 0 0 0.35rem;
	}
	.jobs p {
		margin: 0 0 0.35rem;
	}
	.small-btn {
		padding: 0.35rem 0.75rem;
	}
	.in-guild {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
	}
</style>
