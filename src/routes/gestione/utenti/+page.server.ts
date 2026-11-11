import { desc, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireCapability } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'users.view');

	const q = (event.url.searchParams.get('q') ?? '').trim().slice(0, 60);
	const pageNum = Math.max(1, Number(event.url.searchParams.get('pagina')) || 1);

	const where = q
		? sql`(${schema.users.username} ilike ${'%' + q + '%'} or ${schema.users.email} ilike ${'%' + q + '%'} or exists (
				select 1 from ${schema.characters} c where c.user_id = ${schema.users.id} and c.name ilike ${'%' + q + '%'}))`
		: undefined;

	const rows = await db
		.select({
			id: schema.users.id,
			username: schema.users.username,
			email: schema.users.email,
			createdAt: schema.users.createdAt,
			lastLoginAt: schema.users.lastLoginAt,
			bannedUntil: schema.users.bannedUntil,
			roles: sql<string[]>`coalesce((select array_agg(r.name order by r.name) from ${schema.userRoles} ur join ${schema.roles} r on r.id = ur.role_id where ur.user_id = ${schema.users.id}), '{}')`,
			characters: sql<string[]>`coalesce((select array_agg(c.name order by c.name) from ${schema.characters} c where c.user_id = ${schema.users.id} and c.deleted_at is null), '{}')`
		})
		.from(schema.users)
		.where(where)
		.orderBy(desc(schema.users.createdAt))
		.limit(PAGE_SIZE + 1)
		.offset((pageNum - 1) * PAGE_SIZE);

	const hasNext = rows.length > PAGE_SIZE;
	return {
		q,
		page: pageNum,
		hasNext,
		users: rows.slice(0, PAGE_SIZE).map((u) => ({
			...u,
			createdAt: u.createdAt.toISOString(),
			lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
			banned: !!u.bannedUntil && u.bannedUntil.getTime() > Date.now()
		}))
	};
};
