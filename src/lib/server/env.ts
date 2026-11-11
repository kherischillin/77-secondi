/**
 * Configurazione letta dalle variabili d'ambiente.
 * In sviluppo viene caricato anche il file .env, se presente.
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
	databaseUrl: required('DATABASE_URL'),
	isProduction: process.env.NODE_ENV === 'production'
};
