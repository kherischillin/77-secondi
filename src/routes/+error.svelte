<script lang="ts">
	import { page } from '$app/state';

	const titles: Record<number, string> = {
		403: 'Accesso negato',
		404: 'Pagina non trovata',
		500: 'Qualcosa è andato storto'
	};
</script>

<svelte:head><title>{titles[page.status] ?? 'Errore'}</title></svelte:head>

<h1>{titles[page.status] ?? `Errore ${page.status}`}</h1>
<p class="muted">
	{page.status === 500 ? 'Si è verificato un errore imprevisto. Riprova tra poco.' : page.error?.message}
</p>
<p><a href="/">Torna alla homepage</a></p>
