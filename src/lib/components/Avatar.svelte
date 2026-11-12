<script lang="ts">
	/**
	 * Avatar quadrato del personaggio (bacheche, chat, mappa, presenti).
	 * Senza immagine mostra l'iniziale del nome. La misura cambia a seconda di dove si usa.
	 */
	let { src, name, size = 32 }: { src: string | null | undefined; name: string; size?: number } = $props();
	let broken = $state(false);
	$effect(() => {
		void src;
		broken = false;
	});
</script>

<span class="avatar" style:--size="{size}px" aria-hidden="true" title={name}>
	{#if src && !broken}
		<img {src} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
	{:else}
		<span class="initial">{name.trim().slice(0, 1).toUpperCase() || '?'}</span>
	{/if}
</span>

<style>
	.avatar {
		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		width: var(--size);
		height: var(--size);
		border-radius: calc(var(--size) / 6);
		overflow: hidden;
		background: var(--bg-sunken);
		border: 1px solid var(--border);
		vertical-align: middle;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.initial {
		font-family: var(--font-title);
		font-size: calc(var(--size) * 0.5);
		line-height: 1;
		color: var(--accent);
	}
</style>
