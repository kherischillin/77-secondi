import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { RateLimiter } from './rate-limit.ts';
import { fullName } from '../format.ts';
import { avatarResolver } from './avatars.ts';

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

/**
 * Suggerimenti per il nome di un personaggio: chi inizia per quello che si è scritto
 * (nome, cognome o nome completo), esclusi i personaggi del proprio account.
 */
export async function searchCharacters(q: string, excludeUserId: number, max = 8) {
	const like = q.toLowerCase().replace(/[\\%_]/g, (c) => '\\' + c) + '%';
	const rows = await db
		.select({ id: schema.characters.id, name: schema.characters.name, surname: schema.characters.surname, avatar: schema.characters.avatar })
		.from(schema.characters)
		.where(
			and(
				isNull(schema.characters.deletedAt),
				ne(schema.characters.userId, excludeUserId),
				sql`(lower(${schema.characters.name}) like ${like} or lower(coalesce(${schema.characters.surname}, '')) like ${like} or lower(${schema.characters.name} || ' ' || coalesce(${schema.characters.surname}, '')) like ${like})`
			)
		)
		.orderBy(asc(schema.characters.name))
		.limit(max);
	const src = await avatarResolver();
	return rows.map((r) => ({ id: r.id, name: fullName(r), avatarUrl: src(r.avatar) }));
}

/** Crea una conversazione già pronta tra due personaggi (senza limiti di frequenza: la usa il gioco, es. gli inviti). */
export async function deliverThread(senderId: number, recipientId: number, input: { subject: string; body: string; onGame: boolean }) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const [thread] = await tx
			.insert(schema.messageThreads)
			.values({ subject: input.subject, onGame: input.onGame, lastMessageAt: now })
			.returning();
		await tx.insert(schema.messageParticipants).values([
			{ threadId: thread.id, characterId: senderId, lastReadAt: now },
			{ threadId: thread.id, characterId: recipientId }
		]);
		await tx.insert(schema.privateMessages).values({ threadId: thread.id, senderCharacterId: senderId, body: input.body, createdAt: now });
		return thread;
	});
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
	return deliverThread(sender.id, recipient.id, input);
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

/** Condizione SQL: per questo partecipante la conversazione non è eliminata (o ha messaggi nuovi dopo l'eliminazione). */
function visibleExpr() {
	return sql<boolean>`(${schema.messageParticipants.clearedAt} is null or ${schema.messageThreads.lastMessageAt} > ${schema.messageParticipants.clearedAt})`;
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
			lastReadAt: schema.messageParticipants.lastReadAt,
			other: sql<string>`(
				select string_agg(c.name || coalesce(' ' || c.surname, ''), ', ')
				from ${schema.messageParticipants} mp2 join ${schema.characters} c on c.id = mp2.character_id
				where mp2.thread_id = ${schema.messageThreads.id} and mp2.character_id <> ${characterId}
			)`,
			preview: sql<string>`(
				select left(pm.body, 140) from ${schema.privateMessages} pm
				where pm.thread_id = ${schema.messageThreads.id}
				and pm.created_at > coalesce(${schema.messageParticipants.clearedAt}, '-infinity'::timestamptz)
				order by pm.id desc limit 1
			)`
		})
		.from(schema.messageParticipants)
		.innerJoin(schema.messageThreads, eq(schema.messageParticipants.threadId, schema.messageThreads.id))
		.where(
			and(
				eq(schema.messageParticipants.characterId, characterId),
				archived ? isNotNull(schema.messageParticipants.archivedAt) : isNull(schema.messageParticipants.archivedAt),
				visibleExpr()
			)
		)
		.orderBy(desc(schema.messageThreads.lastMessageAt))
		.limit(200);
	return rows.map((r) => ({
		...r,
		lastMessageAt: r.lastMessageAt.toISOString(),
		// Letta del tutto: l'ultima lettura è successiva all'ultimo messaggio.
		readAt: !r.unread && r.lastReadAt ? r.lastReadAt.toISOString() : null,
		lastReadAt: undefined
	}));
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
	const since = me.clearedAt ?? new Date(0);
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
		.where(and(eq(schema.privateMessages.threadId, threadId), gt(schema.privateMessages.createdAt, since)))
		.orderBy(asc(schema.privateMessages.id));
	// Eliminata e senza messaggi nuovi: per questo personaggio non esiste più.
	if (!messages.length) return null;
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

/** Quante conversazioni ha in archivio un personaggio. */
export async function archivedCount(characterId: number): Promise<number> {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(schema.messageParticipants)
		.innerJoin(schema.messageThreads, eq(schema.messageParticipants.threadId, schema.messageThreads.id))
		.where(and(eq(schema.messageParticipants.characterId, characterId), isNotNull(schema.messageParticipants.archivedAt), visibleExpr()));
	return n;
}

export async function setArchived(threadId: number, characterId: number, archived: boolean, archiveLimit = Infinity) {
	if (archived && (await archivedCount(characterId)) >= archiveLimit) {
		throw new MessageError(
			archiveLimit === 0
				? 'L\'archivio delle missive è disattivato.'
				: `Hai già ${archiveLimit} missive in archivio, il massimo: eliminane qualcuna prima di archiviarne altre.`
		);
	}
	await db
		.update(schema.messageParticipants)
		.set({ archivedAt: archived ? new Date() : null })
		.where(and(eq(schema.messageParticipants.threadId, threadId), eq(schema.messageParticipants.characterId, characterId)));
}

/**
 * Elimina la conversazione per questo personaggio: non la vede più, ma l'altro sì.
 * Se poi arriva un messaggio nuovo ricompare, solo con i messaggi successivi.
 */
export async function deleteForMe(threadIds: number[], characterId: number): Promise<number> {
	const ids = threadIds.filter((id) => Number.isInteger(id) && id > 0);
	if (!ids.length) return 0;
	const rows = await db
		.update(schema.messageParticipants)
		.set({ clearedAt: new Date(), archivedAt: null, lastReadAt: new Date() })
		.where(and(eq(schema.messageParticipants.characterId, characterId), inArray(schema.messageParticipants.threadId, ids)))
		.returning({ id: schema.messageParticipants.threadId });
	await purgeMessages();
	return rows.length;
}

/**
 * Cancellazione automatica: le conversazioni lette del tutto, non archiviate, la cui ultima lettura
 * è più vecchia di `days` giorni vengono eliminate per quel personaggio. Quelle non lette non si toccano.
 */
export async function expireReadThreads(days: number): Promise<number> {
	if (!(days > 0)) return 0;
	const rows = await db.execute<{ thread_id: number }>(sql`
		update ${schema.messageParticipants} mp set cleared_at = now()
		from ${schema.messageThreads} t
		where t.id = mp.thread_id
		and mp.archived_at is null
		and mp.last_read_at is not null
		and mp.last_read_at >= t.last_message_at
		and mp.last_read_at < now() - make_interval(days => ${days})
		and (mp.cleared_at is null or t.last_message_at > mp.cleared_at)
		returning mp.thread_id
	`);
	return rows.length;
}

/** Pulizia del database: messaggi eliminati da tutti i partecipanti e conversazioni rimaste vuote. */
export async function purgeMessages(): Promise<{ messages: number; threads: number }> {
	const messages = await db.execute(sql`
		delete from ${schema.privateMessages} pm
		using (
			select thread_id, min(coalesce(cleared_at, '-infinity'::timestamptz)) as upto
			from ${schema.messageParticipants} group by thread_id
		) c
		where pm.thread_id = c.thread_id and pm.created_at <= c.upto
		returning pm.id
	`);
	const threads = await db.execute(sql`
		delete from ${schema.messageThreads} t
		where not exists (select 1 from ${schema.privateMessages} pm where pm.thread_id = t.id)
		or not exists (select 1 from ${schema.messageParticipants} mp where mp.thread_id = t.id)
		returning t.id
	`);
	return { messages: messages.length, threads: threads.length };
}

/** Lavoro periodico: cancellazione automatica delle missive lette e pulizia. */
export async function messagesMaintenance(days: number) {
	const expired = await expireReadThreads(days);
	const purged = await purgeMessages();
	return { expired, ...purged };
}
