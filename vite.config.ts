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
			adapter: adapter(),
			// Content-Security-Policy: il browser esegue solo gli script del sito (SvelteKit firma i suoi
			// con un codice diverso a ogni pagina). È la seconda barriera se un giorno sfuggisse del testo
			// non neutralizzato. Le schede dei giocatori stanno in un riquadro che eredita queste regole:
			// per questo stili e caratteri via HTTPS restano ammessi (es. Google Fonts nelle schede).
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline', 'https:'],
					'img-src': ['self', 'data:', 'https:'],
					'font-src': ['self', 'data:', 'https:'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	],
	test: {
		include: ['src/**/*.test.ts'],
		// I test con il database (`*.db.test.ts`) condividono un solo database: un file alla volta.
		// Senza TEST_DATABASE_URL si saltano da soli (vedi src/tests/db.ts e `npm run test:db`).
		fileParallelism: !process.env.TEST_DATABASE_URL,
		testTimeout: 30_000,
		hookTimeout: 60_000,
		environment: 'node'
	}
});
