import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Modalità "runes" per tutto il progetto (escluse le librerie esterne).
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Produce un server Node autonomo nella cartella build/, eseguito dal container Docker.
			adapter: adapter()
		})
	],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
