<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let sending = $state(false);
</script>

<svelte:head><title>Iscriviti · {data.siteName}</title></svelte:head>

<h1>Crea il tuo account</h1>

{#if !data.registrationsOpen}
	<div class="alert error">Le iscrizioni sono momentaneamente chiuse.</div>
{:else}
	<p class="muted">L'account è tuo, personale. I personaggi li creerai subito dopo.</p>

	{#if form?.errors?.form}
		<div class="alert error" role="alert">{form.errors.form}</div>
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
			<label for="username">Nome utente</label>
			<input
				id="username"
				name="username"
				type="text"
				autocomplete="username"
				required
				minlength="3"
				maxlength="24"
				value={form?.values?.username ?? ''}
			/>
			<span class="hint">Serve per accedere. Non è il nome del personaggio.</span>
			{#if form?.errors?.username}<p class="field-error">{form.errors.username}</p>{/if}
		</div>
		<div>
			<label for="email">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.values?.email ?? ''}
			/>
			{#if form?.errors?.email}<p class="field-error">{form.errors.email}</p>{/if}
		</div>
		<div>
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength="10"
			/>
			<span class="hint">Almeno 10 caratteri. Una frase lunga è più sicura di una parola complicata.</span>
			{#if form?.errors?.password}<p class="field-error">{form.errors.password}</p>{/if}
		</div>
		<div>
			<label for="passwordConfirm">Ripeti la password</label>
			<input
				id="passwordConfirm"
				name="passwordConfirm"
				type="password"
				autocomplete="new-password"
				required
			/>
			{#if form?.errors?.passwordConfirm}
				<p class="field-error">{form.errors.passwordConfirm}</p>
			{/if}
		</div>
		<button type="submit" disabled={sending}>{sending ? 'Un momento…' : 'Crea account'}</button>
		<p class="muted">Hai già un account? <a href="/accesso">Accedi</a></p>
	</form>
{/if}
