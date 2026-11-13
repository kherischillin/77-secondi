import { gt, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db, schema } from '#lib/server/db/index.ts';
import { requireCapability } from '#lib/server/guards.ts';

export const load: PageServerLoad = async (event) => {
	// Il layout controlla già, ma i load girano in parallelo: senza questo le query partirebbero comunque.
	requireCapability(event, 'admin.access');
	const count = sql<number>`count(*)::int`;
	const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

	const [[users], [characters], [activeSessions], [newUsers]] = await Promise.all([
		db.select({ n: count }).from(schema.users),
		db.select({ n: count }).from(schema.characters).where(isNull(schema.characters.deletedAt)),
		db.select({ n: sql<number>`count(distinct ${schema.sessions.userId})::int` }).from(schema.sessions).where(gt(schema.sessions.expiresAt, new Date())),
		db.select({ n: count }).from(schema.users).where(gt(schema.users.createdAt, dayAgo))
	]);

	return {
		stats: {
			users: users.n,
			characters: characters.n,
			usersWithSessions: activeSessions.n,
			newUsers: newUsers.n
		}
	};
};
