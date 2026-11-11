import { defineConfig } from 'drizzle-kit';

try {
	process.loadEnvFile();
} catch {
	// Nessun file .env: si usano le variabili già presenti nell'ambiente.
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	strict: true,
	verbose: true
});
