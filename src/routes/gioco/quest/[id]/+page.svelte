<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { formatDateTime, fullName } from '#lib/format.ts';

	let { data, form }: PageProps = $props();
	let base = $state(10);
</script>

<svelte:head><title>{data.quest.title} · Quest</title></svelte:head>

<p><a href="/gioco/luogo/{data.quest.locationId}">← Torna al luogo</a></p>
<h1>Quest «{data.quest.title}»</h1>
<p class="muted">
	{#if data.locationName}{data.locationName} · {/if}iniziata il {formatDateTime(data.quest.startedAt)}
	{#if data.quest.endedAt} · conclusa il {formatDateTime(data.quest.endedAt)}{/if}
	{#if data.quest.masterName} · Master: {data.quest.masterName}{/if}
</p>

{#if form?.error}<div class="alert error">{form.error}</div>{/if}

{#if !data.quest.endedAt}
	<div class="alert">La quest è ancora in corso: chiudila dal luogo per assegnare i PX.</div>
{:else if data.quest.xpAwardedAt || form?.success}
	<div class="alert success">
		Punti esperienza assegnati{data.quest.xpAwardedAt ? ` il ${formatDateTime(data.quest.xpAwardedAt)}` : ''}.
	</div>
{:else if data.participants.length === 0}
	<div class="alert">Nessun personaggio ha partecipato alla quest con azioni o prove: non ci sono PX da assegnare.</div>
{:else}
	<h2>Assegna i punti esperienza</h2>
	<p class="muted">
		Partecipanti: chi ha scritto azioni o fatto prove durante la quest. Metti 0 a chi non deve ricevere PX.
		Il Master e i tuoi personaggi non compaiono: nessuno si assegna PX da solo.
	</p>
	<form method="post" action="?/assegna" class="stack card" use:enhance>
		<div class="base">
			<label for="base">Valore uguale per tutti</label>
			<input id="base" type="number" min="-1000" max="1000" bind:value={base} />
		</div>
		<table>
			<thead><tr><th>Personaggio</th><th>PX</th></tr></thead>
			<tbody>
				{#each data.participants as p (p.id)}
					<tr>
						<td><a href="/scheda/{p.id}" target="_blank">{fullName(p)}</a></td>
						<td>
							<input
								name="px_{p.id}"
								type="number"
								min="-1000"
								max="1000"
								value={base}
								aria-label="PX per {fullName(p)}"
							/>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div>
			<label for="reason">Motivo <span class="hint">compare nello storico PX della scheda</span></label>
			<input id="reason" name="reason" type="text" maxlength="200" value="Quest «{data.quest.title}»" />
		</div>
		<div><button type="submit">Assegna PX</button></div>
	</form>
{/if}

<style>
	.base {
		max-width: 240px;
	}
	td input {
		max-width: 120px;
	}
</style>
