import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * La connessione al database si crea al primo utilizzo, non quando il file viene importato.
 * Così la costruzione del sito (che importa questo file per analizzarlo) non ha bisogno del database.
 */
let instance: Database | null = null;

function getDb(): Database {
	instance ??= drizzle(postgres(env.databaseUrl, { max: 10 }), { schema });
	return instance;
}

export const db = new Proxy({} as Database, {
	get(_target, property) {
		const real = getDb();
		const value = Reflect.get(real, property, real);
		return typeof value === 'function' ? value.bind(real) : value;
	}
});

export { schema };
