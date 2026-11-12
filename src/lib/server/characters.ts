import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { move } from './money.ts';
import { db, schema } from './db/index.ts';

export class CharacterError extends Error {
	readonly field: string;
	constructor(field: string, message: string) {
		super(message);
		this.field = field;
	}
}

export async function listUserCharacters(userId: number) {
	return db
		.select({
			id: schema.characters.id,
			name: schema.characters.name,
			surname: schema.characters.surname,
			bio: schema.characters.bio,
			portrait: schema.characters.portrait,
			createdAt: schema.characters.createdAt,
			lastPlayedAt: schema.characters.lastPlayedAt
		})
		.from(schema.characters)
		.where(and(eq(schema.characters.userId, userId), isNull(schema.characters.deletedAt)))
		.orderBy(asc(schema.characters.createdAt));
}

export async function createCharacter(
	userId: number,
	maxPerUser: number,
	input: { name: string; surname: string | null; bio: string | null },
	startingMoney = 0
) {
	return db.transaction(async (tx) => {
		// Blocca le righe dell'utente: due richieste simultanee non possono superare il limite.
		await tx.execute(sql`select id from ${schema.users} where id = ${userId} for update`);

		const [{ total }] = await tx
			.select({ total: sql<number>`count(*)::int` })
			.from(schema.characters)
			.where(and(eq(schema.characters.userId, userId), isNull(schema.characters.deletedAt)));
		if (total >= maxPerUser) {
			throw new CharacterError(
				'form',
				`Hai già raggiunto il numero massimo di personaggi (${maxPerUser}).`
			);
		}

		// Il nome resta riservato anche dopo una cancellazione: compare nei log e nelle vecchie giocate.
		const [taken] = await tx
			.select({ id: schema.characters.id })
			.from(schema.characters)
			.where(sql`lower(${schema.characters.name}) = lower(${input.name})`)
			.limit(1);
		if (taken) throw new CharacterError('name', 'Questo nome è già usato da un altro personaggio.');

		const [character] = await tx
			.insert(schema.characters)
			.values({ userId, name: input.name, surname: input.surname, bio: input.bio })
			.returning();
		// Denaro iniziale, registrato nei movimenti come tutto il resto.
		await move(tx, character.id, 'cash', startingMoney, 'start');
		return character;
	});
}

/** Restituisce il PG solo se appartiene all'utente ed è attivo. */
export async function getOwnedCharacter(userId: number, characterId: number) {
	const [c] = await db
		.select()
		.from(schema.characters)
		.where(
			and(
				eq(schema.characters.id, characterId),
				eq(schema.characters.userId, userId),
				isNull(schema.characters.deletedAt)
			)
		);
	return c ?? null;
}

export async function softDeleteCharacter(characterId: number) {
	await db.transaction(async (tx) => {
		await tx
			.update(schema.characters)
			.set({ deletedAt: new Date() })
			.where(eq(schema.characters.id, characterId));
		await tx
			.update(schema.sessions)
			.set({ activeCharacterId: null })
			.where(eq(schema.sessions.activeCharacterId, characterId));
	});
}

export async function touchCharacter(characterId: number) {
	await db
		.update(schema.characters)
		.set({ lastPlayedAt: new Date() })
		.where(eq(schema.characters.id, characterId));
}
