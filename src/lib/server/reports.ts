import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { getMessageWithLocation } from './chat-service.ts';
import { boardAccess } from '../social.ts';
import { viewerFor } from './boards.ts';
import { characterIdsOf } from './giocate.ts';
import { RateLimiter } from './rate-limit.ts';
import { canSee } from './realtime.ts';
import { fullName } from '../format.ts';
import type { ReportTarget } from '../master.ts';

export class ReportError extends Error {}

/** Al massimo 10 segnalazioni all'ora per account. */
const reportLimiter = new RateLimiter(10, 60 * 60 * 1000);

export type ReportSnapshot = {
	author: string | null;
	authorCharacterId: number | null;
	text: string;
	where: string;
	link: string | null;
	createdAt: string | null;
};

/**
 * Copia del contenuto segnalato. Restituisce null se il contenuto non esiste
 * o se chi segnala non può vederlo: non si segnala ciò che non si è letto.
 */
export async function snapshotFor(type: ReportTarget, id: number, locals: App.Locals): Promise<ReportSnapshot | null> {
	const user = locals.user!;
	switch (type) {
		case 'chat_message': {
			const found = await getMessageWithLocation(id);
			if (!found || found.view.hidden) return null;
			const mine = await characterIdsOf(user.id);
			if (!mine.some((c) => canSee(found.view, c))) return null;
			return {
				author: found.view.kind === 'npc' ? `${found.view.npcName} (PNG di ${found.view.characterName})` : found.view.characterName,
				authorCharacterId: found.view.characterId,
				text: found.view.body,
				where: `Chat: ${found.locationName}`,
				link: `/gioco/luogo/${found.locationId}`,
				createdAt: found.view.createdAt
			};
		}
		case 'board_post': {
			const [row] = await db
				.select({ post: schema.boardPosts, thread: schema.boardThreads, board: schema.boards, characterName: schema.characters.name, characterSurname: schema.characters.surname, username: schema.users.username })
				.from(schema.boardPosts)
				.innerJoin(schema.boardThreads, eq(schema.boardPosts.threadId, schema.boardThreads.id))
				.innerJoin(schema.boards, eq(schema.boardThreads.boardId, schema.boards.id))
				.leftJoin(schema.characters, eq(schema.boardPosts.authorCharacterId, schema.characters.id))
				.leftJoin(schema.users, eq(schema.boardPosts.authorUserId, schema.users.id))
				.where(eq(schema.boardPosts.id, id));
			if (!row || row.post.hiddenAt) return null;
			if (!boardAccess(row.board, await viewerFor(locals)).canRead) return null;
			return {
				author: row.characterName ? fullName({ name: row.characterName, surname: row.characterSurname }) : row.username,
				authorCharacterId: row.post.authorCharacterId,
				text: row.post.body,
				where: `Bacheca «${row.board.name}», discussione «${row.thread.title}»`,
				link: `/bacheche/discussione/${row.thread.id}`,
				createdAt: row.post.createdAt.toISOString()
			};
		}
		case 'private_message': {
			const [row] = await db
				.select({ msg: schema.privateMessages, subject: schema.messageThreads.subject, name: schema.characters.name, surname: schema.characters.surname })
				.from(schema.privateMessages)
				.innerJoin(schema.messageThreads, eq(schema.privateMessages.threadId, schema.messageThreads.id))
				.leftJoin(schema.characters, eq(schema.privateMessages.senderCharacterId, schema.characters.id))
				.where(eq(schema.privateMessages.id, id));
			if (!row) return null;
			const mine = await characterIdsOf(user.id);
			const participants = await db
				.select({ id: schema.messageParticipants.characterId })
				.from(schema.messageParticipants)
				.where(eq(schema.messageParticipants.threadId, row.msg.threadId));
			if (!participants.some((p) => mine.includes(p.id))) return null;
			return {
				author: row.name ? fullName({ name: row.name, surname: row.surname }) : null,
				authorCharacterId: row.msg.senderCharacterId,
				text: row.msg.body,
				where: `Missiva «${row.subject}»`,
				// Le missive restano private: lo staff vede solo la copia segnalata.
				link: null,
				createdAt: row.msg.createdAt.toISOString()
			};
		}
		case 'character': {
			const [c] = await db.select().from(schema.characters).where(eq(schema.characters.id, id));
			if (!c || c.deletedAt) return null;
			return {
				author: fullName(c),
				authorCharacterId: c.id,
				text: [c.bio, c.appearance, c.personality, c.offGame].filter(Boolean).join('\n\n') || '(scheda senza testo)',
				where: 'Scheda del personaggio',
				link: `/scheda/${c.id}`,
				createdAt: null
			};
		}
	}
}

export async function createReport(locals: App.Locals, input: { targetType: ReportTarget; targetId: number; reason: string }) {
	const user = locals.user!;
	if (reportLimiter.isLimited(String(user.id))) throw new ReportError('Hai inviato molte segnalazioni: riprova più tardi.');
	const snapshot = await snapshotFor(input.targetType, input.targetId, locals);
	if (!snapshot) throw new ReportError('Contenuto non trovato.');
	const [dup] = await db
		.select({ id: schema.reports.id })
		.from(schema.reports)
		.where(
			and(
				eq(schema.reports.reporterUserId, user.id),
				eq(schema.reports.targetType, input.targetType),
				eq(schema.reports.targetId, input.targetId),
				ne(schema.reports.status, 'closed')
			)
		);
	if (dup) throw new ReportError('Hai già segnalato questo contenuto: lo staff se ne sta occupando.');
	reportLimiter.hit(String(user.id));
	const [report] = await db
		.insert(schema.reports)
		.values({ reporterUserId: user.id, targetType: input.targetType, targetId: input.targetId, snapshot, reason: input.reason })
		.returning();
	return report;
}

export async function listReports(status: 'open' | 'in_progress' | 'closed') {
	const rows = await db
		.select({ report: schema.reports, reporter: schema.users.username })
		.from(schema.reports)
		.leftJoin(schema.users, eq(schema.reports.reporterUserId, schema.users.id))
		.where(eq(schema.reports.status, status))
		.orderBy(status === 'closed' ? desc(schema.reports.closedAt) : asc(schema.reports.createdAt))
		.limit(200);
	const handlerIds = [...new Set(rows.map((r) => r.report.handledByUserId).filter((x): x is number => !!x))];
	const handlers = handlerIds.length
		? await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(inArray(schema.users.id, handlerIds))
		: [];
	return rows.map(({ report: r, reporter }) => ({
		id: r.id,
		targetType: r.targetType,
		targetId: r.targetId,
		snapshot: r.snapshot as ReportSnapshot,
		reason: r.reason,
		status: r.status,
		reporter,
		handler: handlers.find((h) => h.id === r.handledByUserId)?.username ?? null,
		resolution: r.resolution,
		createdAt: r.createdAt.toISOString(),
		closedAt: r.closedAt?.toISOString() ?? null
	}));
}

export async function openReportsCount() {
	const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.reports).where(ne(schema.reports.status, 'closed'));
	return n;
}

export async function takeReport(id: number, userId: number) {
	await db.update(schema.reports).set({ status: 'in_progress', handledByUserId: userId }).where(and(eq(schema.reports.id, id), ne(schema.reports.status, 'closed')));
}

export async function closeReport(id: number, userId: number, resolution: string) {
	const [r] = await db
		.update(schema.reports)
		.set({ status: 'closed', handledByUserId: userId, resolution: resolution || null, closedAt: new Date() })
		.where(eq(schema.reports.id, id))
		.returning();
	return r ?? null;
}
