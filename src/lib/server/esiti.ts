import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import type { EsitoCheck } from '../master.ts';
import { fullName } from '../format.ts';

export class EsitoError extends Error {}

export async function createEsito(characterId: number, userId: number, input: { title: string; body: string; offNote: string }) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const [esito] = await tx
			.insert(schema.esiti)
			.values({ characterId, title: input.title, createdAt: now, lastActivityAt: now, playerReadAt: now })
			.returning();
		await tx.insert(schema.esitoMessages).values({
			esitoId: esito.id,
			authorUserId: userId,
			fromMaster: false,
			body: input.body,
			offNote: input.offNote || null,
			createdAt: now
		});
		return esito;
	});
}

/** Novità per il giocatore: un messaggio del Master dopo l'ultima lettura. */
const playerUnread = sql<boolean>`exists (
	select 1 from ${schema.esitoMessages} m
	where m.esito_id = ${schema.esiti.id} and m.from_master
	and m.created_at > coalesce(${schema.esiti.playerReadAt}, 'epoch'::timestamptz)
)`;

/** Novità per il Master: un messaggio del giocatore dopo l'ultima lettura del Master. */
const masterUnread = sql<boolean>`exists (
	select 1 from ${schema.esitoMessages} m
	where m.esito_id = ${schema.esiti.id} and not m.from_master
	and m.created_at > coalesce(${schema.esiti.masterReadAt}, 'epoch'::timestamptz)
)`;

export async function listForCharacter(characterId: number) {
	const rows = await db
		.select({
			id: schema.esiti.id,
			title: schema.esiti.title,
			status: schema.esiti.status,
			lastActivityAt: schema.esiti.lastActivityAt,
			unread: playerUnread,
			master: schema.users.username
		})
		.from(schema.esiti)
		.leftJoin(schema.users, eq(schema.esiti.masterUserId, schema.users.id))
		.where(eq(schema.esiti.characterId, characterId))
		.orderBy(desc(schema.esiti.lastActivityAt));
	return rows.map((r) => ({ ...r, lastActivityAt: r.lastActivityAt.toISOString() }));
}

export type MasterFilter = 'da-assegnare' | 'miei' | 'aperti' | 'chiusi';

export async function listForMasters(filter: MasterFilter, masterUserId: number) {
	const where =
		filter === 'da-assegnare'
			? and(eq(schema.esiti.status, 'open'), isNull(schema.esiti.masterUserId))
			: filter === 'miei'
				? and(eq(schema.esiti.status, 'open'), eq(schema.esiti.masterUserId, masterUserId))
				: filter === 'aperti'
					? eq(schema.esiti.status, 'open')
					: eq(schema.esiti.status, 'closed');
	const rows = await db
		.select({
			id: schema.esiti.id,
			title: schema.esiti.title,
			status: schema.esiti.status,
			lastActivityAt: schema.esiti.lastActivityAt,
			characterName: schema.characters.name,
			characterSurname: schema.characters.surname,
			characterUserId: schema.characters.userId,
			master: schema.users.username,
			unread: masterUnread
		})
		.from(schema.esiti)
		.innerJoin(schema.characters, eq(schema.esiti.characterId, schema.characters.id))
		.leftJoin(schema.users, eq(schema.esiti.masterUserId, schema.users.id))
		.where(where)
		.orderBy(filter === 'chiusi' ? desc(schema.esiti.lastActivityAt) : asc(schema.esiti.lastActivityAt))
		.limit(200);
	return rows.map(({ characterName, characterSurname, characterUserId, ...r }) => ({
		...r,
		character: fullName({ name: characterName, surname: characterSurname }),
		/** Il Master non arbitra le richieste dei propri personaggi. */
		ownCharacter: characterUserId === masterUserId,
		lastActivityAt: r.lastActivityAt.toISOString()
	}));
}

/** Numeri per gli avvisi: novità per il giocatore, richieste da gestire per i Master. */
export async function playerUnreadCount(characterId: number) {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(schema.esiti)
		.where(and(eq(schema.esiti.characterId, characterId), playerUnread));
	return n;
}

export async function masterPendingCount(masterUserId: number) {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(schema.esiti)
		.innerJoin(schema.characters, eq(schema.esiti.characterId, schema.characters.id))
		.where(
			and(
				eq(schema.esiti.status, 'open'),
				sql`${schema.characters.userId} <> ${masterUserId}`,
				or(isNull(schema.esiti.masterUserId), and(eq(schema.esiti.masterUserId, masterUserId), masterUnread))
			)
		);
	return n;
}

export async function getEsito(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [row] = await db
		.select({ esito: schema.esiti, character: schema.characters, master: schema.users.username })
		.from(schema.esiti)
		.innerJoin(schema.characters, eq(schema.esiti.characterId, schema.characters.id))
		.leftJoin(schema.users, eq(schema.esiti.masterUserId, schema.users.id))
		.where(eq(schema.esiti.id, id));
	return row ?? null;
}

export async function listEsitoMessages(esitoId: number) {
	const rows = await db
		.select({
			id: schema.esitoMessages.id,
			fromMaster: schema.esitoMessages.fromMaster,
			body: schema.esitoMessages.body,
			offNote: schema.esitoMessages.offNote,
			check: schema.esitoMessages.check,
			createdAt: schema.esitoMessages.createdAt,
			author: schema.users.username
		})
		.from(schema.esitoMessages)
		.leftJoin(schema.users, eq(schema.esitoMessages.authorUserId, schema.users.id))
		.where(eq(schema.esitoMessages.esitoId, esitoId))
		.orderBy(asc(schema.esitoMessages.id));
	return rows.map((r) => ({ ...r, check: r.check as EsitoCheck | null, createdAt: r.createdAt.toISOString() }));
}

export async function addEsitoMessage(
	esitoId: number,
	author: { userId: number; fromMaster: boolean },
	input: { body: string; offNote: string; check?: EsitoCheck | null }
) {
	await db.transaction(async (tx) => {
		const now = new Date();
		await tx.insert(schema.esitoMessages).values({
			esitoId,
			authorUserId: author.userId,
			fromMaster: author.fromMaster,
			body: input.body,
			offNote: input.offNote || null,
			check: input.check ?? null,
			createdAt: now
		});
		const update: Partial<typeof schema.esiti.$inferInsert> = { lastActivityAt: now, status: 'open', closedAt: null };
		if (author.fromMaster) update.masterReadAt = now;
		else update.playerReadAt = now;
		await tx.update(schema.esiti).set(update).where(eq(schema.esiti.id, esitoId));
		// Il primo Master che risponde se ne occupa.
		if (author.fromMaster) {
			await tx
				.update(schema.esiti)
				.set({ masterUserId: author.userId })
				.where(and(eq(schema.esiti.id, esitoId), isNull(schema.esiti.masterUserId)));
		}
	});
}

export async function assignEsito(esitoId: number, masterUserId: number | null) {
	await db.update(schema.esiti).set({ masterUserId }).where(eq(schema.esiti.id, esitoId));
}

export async function setEsitoStatus(esitoId: number, status: 'open' | 'closed') {
	await db
		.update(schema.esiti)
		.set({ status, closedAt: status === 'closed' ? new Date() : null })
		.where(eq(schema.esiti.id, esitoId));
}

export async function markEsitoRead(esitoId: number, as: 'player' | 'master') {
	await db
		.update(schema.esiti)
		.set(as === 'player' ? { playerReadAt: new Date() } : { masterReadAt: new Date() })
		.where(eq(schema.esiti.id, esitoId));
}
