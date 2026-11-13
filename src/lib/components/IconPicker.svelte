<script lang="ts">
	import JobIcon from './JobIcon.svelte';
	import { JOB_ICON_KEYS, JOB_ICONS } from '#lib/job-icons.ts';

	/** Griglia per scegliere un'icona (lavori, negozi, gilde): invia il campo `name`. */
	let { selected, name = 'icon', legend = 'Icona' }: { selected: string; name?: string; legend?: string } = $props();
</script>

<fieldset class="icons">
	<legend>{legend}</legend>
	{#each JOB_ICON_KEYS as k (k)}
		<label class="icon-opt" title={JOB_ICONS[k].label}>
			<input type="radio" {name} value={k} checked={selected === k} />
			<JobIcon icon={k} size={22} />
			<span class="sr">{JOB_ICONS[k].label}</span>
		</label>
	{/each}
</fieldset>

<style>
	.icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		border: 0;
		padding: 0;
		margin: 0;
	}
	.icons legend {
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
	.sr {
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
</style>
