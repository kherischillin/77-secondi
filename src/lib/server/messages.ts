import { and, asc, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { RateLimiter } from './rate-limit.ts';
import { fullName } from '../format.ts';

export class MessageError extends Error {}

/** Al massimo 10 missive al minuto per personaggio. */
const sendLimiter = new RateLimiter(10, 60_000);

function limit(characterId: number) {
	const key = String(characterId);
	if (sendLimiter.isLimited(key)) throw new MessageError('Stai inviando troppe missive: aspetta un minuto.');
	sendLimiter.hit(key);
}

/** Cerca un personaggio attivo per nome ("Selene" oppure "Selene Corvo"). */
export async function findCharacterByName(name: string) {
	const wanted = name.trim().toLowerCase();
	const rows = await db
		.select({ id: schema.characters.id, userId: schema.characters.userId, name: schema.characters.name, surname: schema.characters.surname })
		.from(schema.characters)
		.where(
			and(
				isNull(schema.characters.deletedAt),
				sql`(lower(${schema.characters.name}) = ${wanted} or lower(${schema.characters.name} || ' ' || coalesce(${schema.characters.surname}, '')) = ${wanted})`
			)
		)
		.limit(1);
	return rows[0] ?? null;
}

/** Elenco dei nomi per i suggerimenti nel campo "Destinatario". */
export async function characterDirectory(excludeUserId: number) {
	const rows = await db
		.select({ name: schema.characters.name, surname: schema.characters.surname })
		.from(schema.characters)
		.where(and(isNull(schema.characters.deletedAt), ne(schema.characters.userId, excludeUserId)))
		.orderBy(asc(schema.characters.name))
		.limit(500);
	return rows.map(fullName);
}

export async function startThread(
	sender: { id: number; userId: number },
	recipientName: string,
	input: { subject: string; body: string; onGame: boolean }
) {
	const recipient = await findCharacterByName(recipientName);
	if (!recipient) throw new MessageError(`Nessun personaggio si chiama «${recipientName}».`);
	if (recipient.userId === sender.userId) throw new MessageError('Non puoi scrivere a un altro dei tuoi personaggi.');
	limit(sender.id);

	return db.transaction(async (tx) => {
		const now = new Date();
		const [thread] = await tx
			.insert(schema.messageThreads)
			.values({ subject: input.subject, onGame: input.onGame, lastMessageAt: now })
			.returning();
		await tx.insert(schema.messageParticipants).values([
			{ threadId: thread.id, characterId: sender.id, lastReadAt: now },
			{ threadId: thread.id, characterId: recipient.id }
		]);
		await tx.insert(schema.privateMessages).values({ threadId: thread.id, senderCharacterId: sender.id, body: input.body, createdAt: now });
		return thread;
	});
}

async function participant(threadId: number, characterId: number) {
	const [p] = await db
		.select()
		.from(schema.messageParticipants)
		.where(and(eq(schema.messageParticipants.threadId, threadId), eq(schema.messageParticipants.characterId, characterId)));
	return p ?? null;
}

export async function reply(threadId: number, senderId: number, body: string) {
	if (!(await participant(threadId, senderId))) throw new MessageError('Conversazione non trovata.');
	limit(senderId);
	await db.transaction(async (tx) => {
		const now = new Date();
		await tx.insert(schema.privateMessages).values({ threadId, senderCharacterId: senderId, body, createdAt: now });
		await tx.update(schema.messageThreads).set({ lastMessageAt: now }).where(eq(schema.messageThreads.id, threadId));
		// Un nuovo messaggio riporta la conversazione tra quelle in arrivo per tutti.
		await tx.update(schema.messageParticipants).set({ archivedAt: null }).where(eq(schema.messageParticipants.threadId, threadId));
		await tx
			.update(schema.messageParticipants)
			.set({ lastReadAt: now })
			.where(and(eq(schema.messageParticipants.threadId, threadId), eq(schema.messageParticipants.characterId, senderId)));
	});
}

/** Condizione SQL: la conversazione ha messaggi altrui più recenti dell'ultima lettura. */
function unreadExpr(characterId: number) {
	return sql<boolean>`exists (
		select 1 from ${schema.privateMessages} pm
		where pm.thread_id = ${schema.messageThreads.id}
		and pm.sender_character_id is distinct from ${characterId}
		and pm.created_at > coalesce(${schema.messageParticipants.lastReadAt}, 'epoch'::timestamptz)
	)`;
}

export async function listThreads(characterId: number, archived: boolean) {
	const rows = await db
		.select({
			id: schema.messageThreads.id,
			subject: schema.messageThreads.subject,
			onGame: schema.messageThreads.onGame,
			lastMessageAt: schema.messageThreads.lastMessageAt,
			unread: unreadExpr(characterId),
			other: sql<string>`(
				select string_agg(c.name || coalesce(' ' || c.surname, ''), ', ')
				from ${schema.messageParticipants} mp2 join ${schema.characters} c on c.id = mp2.character_id
				where mp2.thread_id = ${schema.messageThreads.id} and mp2.character_id <> ${characterId}
			)`,
			preview: sql<string>`(
				select left(pm.body, 140) from ${schema.privateMessages} pm
				where pm.thread_id = ${schema.messageThreads.id} order by pm.id desc limit 1
			)`
		})
		.from(schema.messageParticipants)
		.innerJoin(schema.messageThreads, eq(schema.messageParticipants.threadId, schema.messageThreads.id))
		.where(
			and(
				eq(schema.messageParticipants.characterId, characterId),
				archived ? isNotNull(schema.messageParticipants.archivedAt) : isNull(schema.messageParticipants.archivedAt)
			)
		)
		.orderBy(desc(schema.messageThreads.lastMessageAt))
		.limit(200);
	return rows.map((r) => ({ ...r, lastMessageAt: r.lastMessageAt.toISOString() }));
}

export async function unreadCount(characterId: number): Promise<number> {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(schema.messageParticipants)
		.innerJoin(schema.messageThreads, eq(schema.messageParticipants.threadId, schema.messageThreads.id))
		.where(and(eq(schema.messageParticipants.characterId, characterId), unreadExpr(characterId)));
	return n;
}

/** Apre una conversazione (solo se si è partecipanti) e la segna come letta. */
export async function openThread(threadId: number, characterId: number) {
	if (!Number.isInteger(threadId) || threadId <= 0) return null;
	const me = await participant(threadId, characterId);
	if (!me) return null;
	const [thread] = await db.select().from(schema.messageThreads).where(eq(schema.messageThreads.id, threadId));
	const messages = await db
		.select({
			id: schema.privateMessages.id,
			body: schema.privateMessages.body,
			createdAt: schema.privateMessages.createdAt,
			senderId: schema.privateMessages.senderCharacterId,
			senderName: schema.characters.name,
			senderSurname: schema.characters.surname
		})
		.from(schema.privateMessages)
		.leftJoin(schema.characters, eq(schema.privateMessages.senderCharacterId, schema.characters.id))
		.where(eq(schema.privateMessages.threadId, threadId))
		.orderBy(asc(schema.privateMessages.id));
	const others = await db
		.select({ id: schema.characters.id, name: schema.characters.name, surname: schema.characters.surname })
		.from(schema.messageParticipants)
		.innerJoin(schema.characters, eq(schema.messageParticipants.characterId, schema.characters.id))
		.where(and(eq(schema.messageParticipants.threadId, threadId), ne(schema.messageParticipants.characterId, characterId)));

	await db
		.update(schema.messageParticipants)
		.set({ lastReadAt: new Date() })
		.where(and(eq(schema.messageParticipants.threadId, threadId), eq(schema.messageParticipants.characterId, characterId)));

	return {
		thread: { id: thread.id, subject: thread.subject, onGame: thread.onGame, archived: me.archivedAt !== null },
		others,
		messages: messages.map((m) => ({
			id: m.id,
			body: m.body,
			createdAt: m.createdAt.toISOString(),
			senderId: m.senderId,
			senderName: m.senderName ? fullName({ name: m.senderName, surname: m.senderSurname }) : 'Personaggio eliminato'
		}))
	};
}

export async function setArchived(threadId: number, characterId: number, archived: boolean) {
	await db
		.update(schema.messageParticipants)
		.set({ archivedAt: archived ? new Date() : null })
		.where(and(eq(schema.messageParticipants.threadId, threadId), eq(schema.messageParticipants.characterId, characterId)));
}
