/**
 * Configurazione letta dalle variabili d'ambiente.
 * In sviluppo viene caricato anche il file .env, se presente.
 *
 * I valori si leggono solo quando servono davvero: durante la costruzione del sito
 * (npm run build, anche dentro Docker) le variabili non esistono ancora, e non è un errore.
 */
if (!process.env.DATABASE_URL) {
	try {
		process.loadEnvFile();
	} catch {
		// Nessun file .env: va bene, se le variabili arrivano dall'ambiente (es. Docker).
	}
}

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`Variabile d'ambiente mancante: ${name}. Copia .env.example in .env oppure avvia con Docker Compose.`
		);
	}
	return value;
}

export const env = {
	get databaseUrl() {
		return required('DATABASE_URL');
	},
	get isProduction() {
		return process.env.NODE_ENV === 'production';
	}
};
