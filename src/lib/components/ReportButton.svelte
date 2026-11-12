<script lang="ts">
	import type { ReportTarget } from '#lib/master.ts';

	let { targetType, targetId, label = 'Segnala' }: { targetType: ReportTarget; targetId: number; label?: string } = $props();

	let open = $state(false);
	let reason = $state('');
	let sending = $state(false);
	let result = $state<{ ok: boolean; message: string } | null>(null);

	async function send(e: SubmitEvent) {
		e.preventDefault();
		sending = true;
		try {
			const res = await fetch('/segnalazioni', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetType, targetId, reason })
			});
			result = await res.json();
			if (result?.ok) {
				reason = '';
				open = false;
			}
		} catch {
			result = { ok: false, message: 'Invio non riuscito. Riprova.' };
		} finally {
			sending = false;
		}
	}
</script>

<span class="report">
	{#if result?.ok}
		<span class="done">Segnalato</span>
	{:else}
		<button type="button" class="link" onclick={() => (open = !open)} aria-expanded={open}>{label}</button>
	{/if}
	{#if open}
		<form class="pop card" onsubmit={send}>
			<label for="reason-{targetType}-{targetId}">Perché segnali questo contenuto allo staff?</label>
			<textarea id="reason-{targetType}-{targetId}" bind:value={reason} rows="3" maxlength="1000" required></textarea>
			{#if result && !result.ok}<p class="field-error">{result.message}</p>{/if}
			<div class="row">
				<button type="submit" disabled={sending || reason.trim().length < 5}>{sending ? 'Invio…' : 'Invia segnalazione'}</button>
				<button type="button" class="secondary" onclick={() => (open = false)}>Annulla</button>
			</div>
		</form>
	{/if}
</span>

<style>
	.report {
		position: relative;
		display: inline-block;
		font-size: 0.8rem;
	}
	.report :global(button.link) {
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.done {
		color: var(--success);
	}
	.pop {
		position: absolute;
		right: 0;
		top: 1.6rem;
		z-index: 20;
		width: min(320px, 85vw);
		display: grid;
		gap: 0.5rem;
		padding: 0.75rem;
		box-shadow: 0 8px 24px var(--shadow);
		font-size: 0.9rem;
	}
	.pop label {
		font-weight: 600;
		margin: 0;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	.row button {
		font-size: 0.85rem;
		padding: 0.35rem 0.75rem;
	}
</style>
