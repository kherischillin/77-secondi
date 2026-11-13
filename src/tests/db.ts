import { sql } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { bootstrapDatabase } from '#lib/server/bootstrap.ts';
import { createUser } from '#lib/server/users.ts';
import { createCharacter } from '#lib/server/characters.ts';

/**
 * Strumenti per i test che usano un vero database PostgreSQL (file `*.db.test.ts`).
 *
 * Si lanciano con `npm run test:db` e la variabile TEST_DATABASE_URL.
 * ATTENZIONE: ogni file di test SVUOTA il database indicato. Per sicurezza il nome
 * del database deve contenere "test", così non si può cancellare per sbaglio quello del gioco.
 */

const url = process.env.TEST_DATABASE_URL ?? '';

/** Vero se è stato indicato un database di prova: altrimenti i test si saltano. */
export const hasTestDb = url !== '';

if (hasTestDb) {
	const name = new URL(url).pathname.slice(1);
	if (!name.toLowerCase().includes('test')) {
		throw new Error(`TEST_DATABASE_URL punta al database "${name}": il nome deve contenere "test" (i test lo svuotano).`);
	}
	// Il resto del codice legge DATABASE_URL: lo si fa puntare al database di prova.
	process.env.DATABASE_URL = url;
}

/** Riporta il database a nuovo: tabelle ricreate dalle migrazioni, ruoli e dati di esempio. */
export async function freshDatabase() {
	await db.execute(sql`drop schema if exists public cascade`);
	await db.execute(sql`drop schema if exists drizzle cascade`);
	await db.execute(sql`create schema public`);
	await bootstrapDatabase();
}

let counter = 0;

/** Crea un account di prova (il primo creato dopo `freshDatabase` è Amministratore). */
export async function makeUser(name = `utente${++counter}`) {
	const { user, isFirstUser } = await createUser({ username: name, email: `${name}@esempio.test`, password: 'Password-di-prova-77' });
	return { ...user, isFirstUser };
}

/** Crea un personaggio di prova con contanti e conto in banca a scelta. */
export async function makeCharacter(userId: number, opts: { name?: string; cash?: number; bank?: number } = {}) {
	const name = opts.name ?? `Pg${++counter}`;
	const c = await createCharacter(userId, 50, { name, surname: null, bio: null }, opts.cash ?? 0);
	if (opts.bank) await db.update(schema.characters).set({ bank: opts.bank }).where(sql`${schema.characters.id} = ${c.id}`);
	return c;
}

/** Quante promesse sono andate a buon fine e quante no (per le prove di richieste simultanee). */
export async function outcomes(promises: Promise<unknown>[]) {
	const results = await Promise.allSettled(promises);
	return {
		ok: results.filter((r) => r.status === 'fulfilled').length,
		failed: results.filter((r) => r.status === 'rejected').length,
		errors: results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason as Error)
	};
}
