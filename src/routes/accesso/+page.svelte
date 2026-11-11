<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let sending = $state(false);
</script>

<svelte:head><title>Accedi · {data.siteName}</title></svelte:head>

<h1>Accedi</h1>

{#if form?.error}
	<div class="alert error" role="alert">{form.error}</div>
{/if}

<form
	method="post"
	class="stack card"
	use:enhance={() => {
		sending = true;
		return async ({ update }) => {
			await update({ reset: false });
			sending = false;
		};
	}}
>
	<div>
		<label for="username">Nome utente o email</label>
		<input
			id="username"
			name="username"
			type="text"
			autocomplete="username"
			required
			value={form?.values?.username ?? ''}
		/>
	</div>
	<div>
		<label for="password">Password</label>
		<input id="password" name="password" type="password" autocomplete="current-password" required />
	</div>
	<button type="submit" disabled={sending}>{sending ? 'Un momento…' : 'Accedi'}</button>
	<p class="muted">Non hai un account? <a href="/registrazione">Iscriviti</a></p>
</form>
