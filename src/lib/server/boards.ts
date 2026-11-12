import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { avatarResolver } from './avatars.ts';
import { membershipsOf } from './guilds.ts';
import { RateLimiter } from './rate-limit.ts';
import { boardAccess, type BoardViewer } from '../social.ts';
import { fullName } from '../format.ts';

export const POSTS_PER_PAGE = 20;
export const THREADS_PER_PAGE = 30;

export class BoardError extends Error {}

/** 6 messaggi al minuto per account: basta per scrivere, ferma lo spam. */
const postLimiter = new RateLimiter(6, 60_000);

/** Chi sta guardando, con i dati che servono per decidere i permessi. */
export async function viewerFor(locals: App.Locals): Promise<BoardViewer> {
	const caps = locals.user?.capabilities ?? new Set<string>();
	const memberships = locals.character ? await membershipsOf(locals.character.id) : [];
	return {
		hasCharacter: !!locals.character,
		canModerate: caps.has('boards.moderate'),
		canManageGuilds: caps.has('guilds.manage'),
		guildIds: new Set(memberships.map((m) => m.guildId)),
		leadGuildIds: new Set(memberships.filter((m) => m.canManage).map((m) => m.guildId))
	};
}

export async function getBoard(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [b] = await db.select().from(schema.boards).where(eq(schema.boards.id, id));
	return b ?? null;
}

/** Bacheche leggibili, con numero di discussioni, ultimo messaggio e presenza di novità. */
export async function listBoards(viewer: BoardViewer, userId: number) {
	const rows = await db
		.select({
			board: schema.boards,
			guildName: schema.guilds.name,
			threads: sql<number>`(select count(*)::int from ${schema.boardThreads} t where t.board_id = ${schema.boards.id})`,
			lastPostAt: sql<Date | null>`(select max(t.last_post_at) from ${schema.boardThreads} t where t.board_id = ${schema.boards.id})`,
			unread: sql<boolean>`exists (
				select 1 from ${schema.boardThreads} t
				left join ${schema.boardReads} r on r.thread_id = t.id and r.user_id = ${userId}
				where t.board_id = ${schema.boards.id} and (r.read_at is null or r.read_at < t.last_post_at)
			)`
		})
		.from(schema.boards)
		.leftJoin(schema.guilds, eq(schema.boards.guildId, schema.guilds.id))
		.orderBy(asc(schema.boards.sortOrder), asc(schema.boards.name));

	return rows
		.filter((r) => boardAccess(r.board, viewer).canRead)
		.map((r) => ({
			id: r.board.id,
			name: r.board.name,
			description: r.board.description,
			section: r.board.section,
			visibility: r.board.visibility,
			guildName: r.guildName,
			staffOnlyThreads: r.board.staffOnlyThreads,
			threads: r.threads,
			lastPostAt: r.lastPostAt ? new Date(r.lastPostAt).toISOString() : null,
			unread: r.unread
		}));
}

function authorLabel(r: { characterName: string | null; characterSurname: string | null; username: string | null }) {
	if (r.characterName) return fullName({ name: r.characterName, surname: r.characterSurname });
	return r.username ?? 'Utente eliminato';
}

export async function listThreads(boardId: number, userId: number, page: number) {
	const rows = await db
		.select({
			id: schema.boardThreads.id,
			title: schema.boardThreads.title,
			isPinned: schema.boardThreads.isPinned,
			isLocked: schema.boardThreads.isLocked,
			createdAt: schema.boardThreads.createdAt,
			lastPostAt: schema.boardThreads.lastPostAt,
			characterName: schema.characters.name,
			characterSurname: schema.characters.surname,
			characterAvatar: schema.characters.avatar,
			authorCharacterId: schema.boardThreads.authorCharacterId,
			username: schema.users.username,
			posts: sql<number>`(select count(*)::int from ${schema.boardPosts} p where p.thread_id = ${schema.boardThreads.id} and p.hidden_at is null)`,
			readAt: schema.boardReads.readAt
		})
		.from(schema.boardThreads)
		.leftJoin(schema.characters, eq(schema.boardThreads.authorCharacterId, schema.characters.id))
		.leftJoin(schema.users, eq(schema.boardThreads.authorUserId, schema.users.id))
		.leftJoin(schema.boardReads, and(eq(schema.boardReads.threadId, schema.boardThreads.id), eq(schema.boardReads.userId, userId)))
		.where(eq(schema.boardThreads.boardId, boardId))
		.orderBy(desc(schema.boardThreads.isPinned), desc(schema.boardThreads.lastPostAt))
		.limit(THREADS_PER_PAGE + 1)
		.offset((page - 1) * THREADS_PER_PAGE);
	const src = await avatarResolver();
	return {
		hasNext: rows.length > THREADS_PER_PAGE,
		threads: rows.slice(0, THREADS_PER_PAGE).map((r) => ({
			id: r.id,
			title: r.title,
			isPinned: r.isPinned,
			isLocked: r.isLocked,
			author: authorLabel(r),
			authorCharacterId: r.authorCharacterId,
			authorAvatar: src(r.characterAvatar),
			posts: r.posts,
			lastPostAt: r.lastPostAt.toISOString(),
			unread: !r.readAt || r.readAt < r.lastPostAt
		}))
	};
}

export async function getThread(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [t] = await db.select().from(schema.boardThreads).where(eq(schema.boardThreads.id, id));
	return t ?? null;
}

export async function listPosts(threadId: number, page: number, includeHidden: boolean) {
	const where = includeHidden
		? eq(schema.boardPosts.threadId, threadId)
		: and(eq(schema.boardPosts.threadId, threadId), sql`${schema.boardPosts.hiddenAt} is null`);
	const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.boardPosts).where(where);
	const rows = await db
		.select({
			id: schema.boardPosts.id,
			body: schema.boardPosts.body,
			createdAt: schema.boardPosts.createdAt,
			editedAt: schema.boardPosts.editedAt,
			hiddenAt: schema.boardPosts.hiddenAt,
			authorUserId: schema.boardPosts.authorUserId,
			characterId: schema.boardPosts.authorCharacterId,
			characterName: schema.characters.name,
			characterSurname: schema.characters.surname,
			characterAvatar: schema.characters.avatar,
			username: schema.users.username
		})
		.from(schema.boardPosts)
		.leftJoin(schema.characters, eq(schema.boardPosts.authorCharacterId, schema.characters.id))
		.leftJoin(schema.users, eq(schema.boardPosts.authorUserId, schema.users.id))
		.where(where)
		.orderBy(asc(schema.boardPosts.id))
		.limit(POSTS_PER_PAGE)
		.offset((page - 1) * POSTS_PER_PAGE);
	const src = await avatarResolver();
	return {
		pages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)),
		posts: rows.map((r) => ({
			id: r.id,
			body: r.body,
			createdAt: r.createdAt.toISOString(),
			editedAt: r.editedAt?.toISOString() ?? null,
			hidden: r.hiddenAt !== null,
			authorUserId: r.authorUserId,
			characterId: r.characterId,
			author: authorLabel(r),
			authorAvatar: src(r.characterAvatar)
		}))
	};
}

function checkRate(userId: number) {
	const key = String(userId);
	if (postLimiter.isLimited(key)) throw new BoardError('Stai scrivendo troppo in fretta: aspetta un minuto.');
	postLimiter.hit(key);
}

export type Author = { userId: number; characterId: number | null };

export async function createThread(boardId: number, author: Author, title: string, body: string) {
	checkRate(author.userId);
	return db.transaction(async (tx) => {
		const now = new Date();
		const [thread] = await tx
			.insert(schema.boardThreads)
			.values({ boardId, title, authorUserId: author.userId, authorCharacterId: author.characterId, createdAt: now, lastPostAt: now })
			.returning();
		await tx.insert(schema.boardPosts).values({ threadId: thread.id, authorUserId: author.userId, authorCharacterId: author.characterId, body, createdAt: now });
		await tx.insert(schema.boardReads).values({ userId: author.userId, threadId: thread.id, readAt: now });
		return thread;
	});
}

export async function addPost(threadId: number, author: Author, body: string) {
	checkRate(author.userId);
	await db.transaction(async (tx) => {
		const now = new Date();
		await tx.insert(schema.boardPosts).values({ threadId, authorUserId: author.userId, authorCharacterId: author.characterId, body, createdAt: now });
		await tx.update(schema.boardThreads).set({ lastPostAt: now }).where(eq(schema.boardThreads.id, threadId));
	});
}

/** Modifica: solo l'autore del messaggio. */
export async function editPost(postId: number, userId: number, body: string) {
	const [p] = await db.select().from(schema.boardPosts).where(eq(schema.boardPosts.id, postId));
	if (!p || p.authorUserId !== userId) throw new BoardError('Puoi modificare solo i tuoi messaggi.');
	if (p.hiddenAt) throw new BoardError('Il messaggio è stato nascosto da un moderatore.');
	await db.update(schema.boardPosts).set({ body, editedAt: new Date() }).where(eq(schema.boardPosts.id, postId));
	return p.threadId;
}

export async function setPostHidden(postId: number, moderatorId: number, hidden: boolean) {
	const [p] = await db
		.update(schema.boardPosts)
		.set(hidden ? { hiddenAt: new Date(), hiddenByUserId: moderatorId } : { hiddenAt: null, hiddenByUserId: null })
		.where(eq(schema.boardPosts.id, postId))
		.returning();
	return p ?? null;
}

export async function setThreadFlags(threadId: number, flags: { isPinned?: boolean; isLocked?: boolean }) {
	await db.update(schema.boardThreads).set(flags).where(eq(schema.boardThreads.id, threadId));
}

export async function deleteThread(threadId: number) {
	await db.delete(schema.boardThreads).where(eq(schema.boardThreads.id, threadId));
}

export async function markRead(userId: number, threadId: number) {
	await db
		.insert(schema.boardReads)
		.values({ userId, threadId, readAt: new Date() })
		.onConflictDoUpdate({ target: [schema.boardReads.userId, schema.boardReads.threadId], set: { readAt: new Date() } });
}

export async function markBoardRead(userId: number, boardId: number) {
	const threads = await db.select({ id: schema.boardThreads.id }).from(schema.boardThreads).where(eq(schema.boardThreads.boardId, boardId));
	for (const t of threads) await markRead(userId, t.id);
}

/** Al primo avvio crea alcune bacheche di esempio, modificabili o eliminabili dal pannello. */
export async function seedBoards() {
	const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'boardsSeeded'));
	if (done) return;
	const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.boards);
	if (n === 0) {
		await db.insert(schema.boards).values([
			{ name: 'Annunci dello staff', description: 'Novità e comunicazioni ufficiali sul gioco.', section: 'off', staffOnlyThreads: true, sortOrder: 1 },
			{ name: 'Piazza dei giocatori', description: 'Chiacchiere, domande e organizzazione tra giocatori.', section: 'off', sortOrder: 2 },
			{ name: 'Cronache del mondo', description: 'Notizie e avvenimenti del mondo di gioco, scritti dai personaggi.', section: 'on', sortOrder: 3 },
			{ name: 'Sala dello staff', description: 'Riservata allo staff.', section: 'off', visibility: 'staff', sortOrder: 50 }
		]);
	}
	await db.insert(schema.settings).values({ key: 'boardsSeeded', value: true }).onConflictDoNothing();
}
