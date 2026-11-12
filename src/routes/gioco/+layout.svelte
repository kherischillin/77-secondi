<script lang="ts">
	import type { LayoutProps } from './$types';

	// La navigazione di gioco (Mappa, Presenti, Uffici) è nella barra in alto.
	let { children }: LayoutProps = $props();
</script>

{@render children()}
