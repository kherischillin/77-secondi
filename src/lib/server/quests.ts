import { and, asc, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { fullName } from '../format.ts';

export type QuestView = {
	id: number;
	masterCharacterId: number | null;
	title: string;
	locationId: number;
	masterUserId: number | null;
	masterName: string | null;
	startedAt: string;
	endedAt: string | null;
	xpAwardedAt: string | null;
};

export class QuestError extends Error {}

async function toView(q: typeof schema.quests.$inferSelect): Promise<QuestView> {
	let masterName: string | null = null;
	if (q.masterCharacterId) {
		const [c] = await db
			.select({ name: schema.characters.name, surname: schema.characters.surname })
			.from(schema.characters)
			.where(eq(schema.characters.id, q.masterCharacterId));
		if (c) masterName = fullName(c);
	}
	return {
		id: q.id,
		masterCharacterId: q.masterCharacterId,
		title: q.title,
		locationId: q.locationId,
		masterUserId: q.masterUserId,
		masterName,
		startedAt: q.startedAt.toISOString(),
		endedAt: q.endedAt?.toISOString() ?? null,
		xpAwardedAt: q.xpAwardedAt?.toISOString() ?? null
	};
}

export async function getActiveQuest(locationId: number): Promise<QuestView | null> {
	const [q] = await db
		.select()
		.from(schema.quests)
		.where(and(eq(schema.quests.locationId, locationId), isNull(schema.quests.endedAt)));
	return q ? toView(q) : null;
}

export async function getQuest(id: number): Promise<QuestView | null> {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [q] = await db.select().from(schema.quests).where(eq(schema.quests.id, id));
	return q ? toView(q) : null;
}

export async function startQuest(locationId: number, title: string, masterUserId: number, masterCharacterId: number) {
	try {
		const [q] = await db
			.insert(schema.quests)
			.values({ locationId, title, masterUserId, masterCharacterId })
			.returning();
		return toView(q);
	} catch (e) {
		// L'indice unico impedisce due quest aperte nello stesso luogo.
		if (String((e as { code?: string })?.code ?? (e as Error)?.message).includes('23505')) {
			throw new QuestError('In questo luogo c’è già una quest in corso.');
		}
		throw e;
	}
}

export async function endQuest(questId: number) {
	const [q] = await db
		.update(schema.quests)
		.set({ endedAt: new Date() })
		.where(and(eq(schema.quests.id, questId), isNull(schema.quests.endedAt)))
		.returning();
	return q ? toView(q) : null;
}

/**
 * Segna i PX della quest come assegnati, una volta sola.
 * Restituisce false se qualcun altro (o un doppio clic) li ha già assegnati.
 */
export async function claimXpAward(questId: number): Promise<boolean> {
	const rows = await db
		.update(schema.quests)
		.set({ xpAwardedAt: new Date() })
		.where(and(eq(schema.quests.id, questId), isNotNull(schema.quests.endedAt), isNull(schema.quests.xpAwardedAt)))
		.returning({ id: schema.quests.id });
	return rows.length === 1;
}

/**
 * Personaggi che hanno partecipato alla quest (azioni, prove, dadi, sussurri).
 * Esclusi il personaggio del Master e tutti i personaggi dell'account indicato:
 * chi assegna i PX non può assegnarli a se stesso.
 */
export async function questParticipants(questId: number, excludeUserId?: number) {
	const quest = await getQuest(questId);
	const rows = await db
		.selectDistinct({
			id: schema.characters.id,
			name: schema.characters.name,
			surname: schema.characters.surname,
			userId: schema.characters.userId
		})
		.from(schema.chatMessages)
		.innerJoin(schema.characters, eq(schema.chatMessages.characterId, schema.characters.id))
		.where(
			and(
				eq(schema.chatMessages.questId, questId),
				isNull(schema.chatMessages.deletedAt),
				sql`${schema.chatMessages.kind} in ('action', 'check', 'dice', 'whisper')`
			)
		)
		.orderBy(asc(schema.characters.name));
	return rows
		.filter((r) => r.id !== quest?.masterCharacterId && r.userId !== excludeUserId && r.userId !== quest?.masterUserId)
		.map(({ userId: _u, ...r }) => r);
}

/** Quest concluse in cui i PX non sono ancora stati assegnati, guidate da questo account. */
export async function pendingXpQuests(masterUserId: number) {
	return db
		.select({ id: schema.quests.id, title: schema.quests.title, endedAt: schema.quests.endedAt })
		.from(schema.quests)
		.where(
			and(
				eq(schema.quests.masterUserId, masterUserId),
				isNotNull(schema.quests.endedAt),
				isNull(schema.quests.xpAwardedAt)
			)
		)
		.orderBy(asc(schema.quests.endedAt));
}
