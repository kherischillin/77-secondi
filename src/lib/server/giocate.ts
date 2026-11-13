import { and, arrayOverlaps, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { loadRange } from './chat-service.ts';
import { awardXp } from './sheet.ts';
import { giocataMessages, giocataParticipants } from '../master.ts';
import type { ChatMessageView } from '../chat.ts';

export class GiocataError extends Error {}

export async function createGiocata(input: {
	location: { id: number; name: string };
	range: { from: Date; to: Date } | { questId: number };
	title: string;
	isPublic: boolean;
	creator: { userId: number; characterId: number; isReviewer: boolean };
	/** Stanze private: solo i messaggi della prenotazione in corso. */
	since?: Date | null;
}) {
	const all = (await loadRange(input.location.id, input.range)).filter((m) => !input.since || new Date(m.createdAt) >= input.since);
	const messages = giocataMessages(all);
	const { players, masters } = giocataParticipants(messages);
	const participantIds = [...players, ...masters].map((p) => p.id);
	if (messages.filter((m) => m.kind !== 'system').length === 0) {
		throw new GiocataError('In questo intervallo non c’è nessun messaggio da registrare.');
	}
	// Si registrano solo le giocate a cui si è partecipato (i revisori possono registrare qualsiasi giocata).
	if (!participantIds.includes(input.creator.characterId) && !input.creator.isReviewer) {
		throw new GiocataError('Puoi registrare solo le giocate a cui ha partecipato il tuo personaggio.');
	}
	const fromAt = new Date(messages[0].createdAt);
	const toAt = new Date(messages[messages.length - 1].createdAt);
	const [g] = await db
		.insert(schema.giocate)
		.values({
			title: input.title,
			locationId: input.location.id,
			locationName: input.location.name,
			questId: 'questId' in input.range ? input.range.questId : null,
			createdByUserId: input.creator.userId,
			createdByCharacterId: input.creator.characterId,
			fromAt,
			toAt,
			messages,
			participantIds,
			isPublic: input.isPublic
		})
		.returning();
	return g;
}

export async function getGiocata(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [g] = await db.select().from(schema.giocate).where(eq(schema.giocate.id, id));
	return g ?? null;
}

/** Id dei personaggi (anche cancellati) di un account: servono per i controlli di accesso. */
export async function characterIdsOf(userId: number) {
	const rows = await db.select({ id: schema.characters.id }).from(schema.characters).where(eq(schema.characters.userId, userId));
	return rows.map((r) => r.id);
}

/** Può leggerla: se è pubblica, se si è partecipanti o autori, oppure se si è revisori. */
export async function canReadGiocata(g: typeof schema.giocate.$inferSelect, user: { id: number; capabilities: ReadonlySet<string> }) {
	if (g.isPublic || g.createdByUserId === user.id || user.capabilities.has('giocate.review')) return true;
	const mine = await characterIdsOf(user.id);
	return g.participantIds.some((id) => mine.includes(id));
}

export function giocataView(g: typeof schema.giocate.$inferSelect) {
	return {
		id: g.id,
		title: g.title,
		locationId: g.locationId,
		locationName: g.locationName,
		questId: g.questId,
		fromAt: g.fromAt.toISOString(),
		toAt: g.toAt.toISOString(),
		isPublic: g.isPublic,
		createdByUserId: g.createdByUserId,
		reviewRequestedAt: g.reviewRequestedAt?.toISOString() ?? null,
		reviewedAt: g.reviewedAt?.toISOString() ?? null,
		reviewNote: g.reviewNote,
		messages: g.messages as ChatMessageView[]
	};
}

/** Giocate di un account: a cui hanno partecipato i suoi personaggi o che ha registrato lui. */
export async function listForUser(userId: number) {
	const mine = await characterIdsOf(userId);
	const rows = await db
		.select({
			id: schema.giocate.id,
			title: schema.giocate.title,
			locationName: schema.giocate.locationName,
			fromAt: schema.giocate.fromAt,
			isPublic: schema.giocate.isPublic,
			reviewRequestedAt: schema.giocate.reviewRequestedAt,
			reviewedAt: schema.giocate.reviewedAt
		})
		.from(schema.giocate)
		.where(
			or(
				eq(schema.giocate.createdByUserId, userId),
				mine.length ? arrayOverlaps(schema.giocate.participantIds, mine) : sql`false`
			)
		)
		.orderBy(desc(schema.giocate.fromAt))
		.limit(200);
	return rows.map((r) => ({
		...r,
		fromAt: r.fromAt.toISOString(),
		reviewRequestedAt: r.reviewRequestedAt?.toISOString() ?? null,
		reviewedAt: r.reviewedAt?.toISOString() ?? null
	}));
}

/** Giocate pubbliche di un personaggio, per la scheda. */
export async function listPublicForCharacter(characterId: number) {
	const rows = await db
		.select({ id: schema.giocate.id, title: schema.giocate.title, locationName: schema.giocate.locationName, fromAt: schema.giocate.fromAt })
		.from(schema.giocate)
		.where(and(eq(schema.giocate.isPublic, true), sql`${characterId} = any(${schema.giocate.participantIds})`))
		.orderBy(desc(schema.giocate.fromAt))
		.limit(20);
	return rows.map((r) => ({ ...r, fromAt: r.fromAt.toISOString() }));
}

export async function listForReview(filter: 'da-rivedere' | 'riviste') {
	const rows = await db
		.select({
			id: schema.giocate.id,
			title: schema.giocate.title,
			locationName: schema.giocate.locationName,
			fromAt: schema.giocate.fromAt,
			reviewRequestedAt: schema.giocate.reviewRequestedAt,
			reviewedAt: schema.giocate.reviewedAt,
			participants: sql<number>`cardinality(${schema.giocate.participantIds})`
		})
		.from(schema.giocate)
		.where(
			filter === 'da-rivedere'
				? and(isNotNull(schema.giocate.reviewRequestedAt), isNull(schema.giocate.reviewedAt))
				: isNotNull(schema.giocate.reviewedAt)
		)
		.orderBy(filter === 'da-rivedere' ? schema.giocate.reviewRequestedAt : desc(schema.giocate.reviewedAt))
		.limit(200);
	return rows.map((r) => ({
		...r,
		fromAt: r.fromAt.toISOString(),
		reviewRequestedAt: r.reviewRequestedAt?.toISOString() ?? null,
		reviewedAt: r.reviewedAt?.toISOString() ?? null
	}));
}

export async function pendingReviewCount() {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(schema.giocate)
		.where(and(isNotNull(schema.giocate.reviewRequestedAt), isNull(schema.giocate.reviewedAt)));
	return n;
}

export async function requestReview(id: number) {
	await db
		.update(schema.giocate)
		.set({ reviewRequestedAt: new Date() })
		.where(and(eq(schema.giocate.id, id), isNull(schema.giocate.reviewRequestedAt)));
}

export async function setPublic(id: number, isPublic: boolean) {
	await db.update(schema.giocate).set({ isPublic }).where(eq(schema.giocate.id, id));
}

/**
 * Revisione del Master: nota e PX ai partecipanti (esclusi i personaggi del revisore).
 * Si fa una volta sola: chi arriva secondo riceve un errore.
 */
export async function reviewGiocata(id: number, reviewer: { userId: number }, note: string, awards: { characterId: number; amount: number }[], title: string) {
	const claimed = await db
		.update(schema.giocate)
		.set({ reviewedAt: new Date(), reviewedByUserId: reviewer.userId, reviewNote: note || null })
		.where(and(eq(schema.giocate.id, id), isNull(schema.giocate.reviewedAt)))
		.returning({ id: schema.giocate.id });
	if (!claimed.length) throw new GiocataError('Questa giocata è già stata rivista.');
	const own = await characterIdsOf(reviewer.userId);
	for (const a of awards) {
		if (a.amount !== 0 && !own.includes(a.characterId)) {
			await awardXp([a.characterId], a.amount, `Giocata «${title}»`, reviewer.userId);
		}
	}
}

export async function deleteGiocata(id: number) {
	await db.delete(schema.giocate).where(eq(schema.giocate.id, id));
}

/** Quest più recente del luogo (in corso o conclusa nelle ultime 24 ore), per "registra tutta la quest". */
export async function recentQuest(locationId: number) {
	const [q] = await db
		.select({ id: schema.quests.id, title: schema.quests.title, endedAt: schema.quests.endedAt })
		.from(schema.quests)
		.where(
			and(
				eq(schema.quests.locationId, locationId),
				or(isNull(schema.quests.endedAt), sql`${schema.quests.endedAt} > now() - interval '24 hours'`)
			)
		)
		.orderBy(desc(schema.quests.startedAt))
		.limit(1);
	return q ?? null;
}
