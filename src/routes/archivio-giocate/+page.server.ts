import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';

const PAGE = 30;

/** Uffici → Archivio giocate: tutte le giocate registrate che i giocatori hanno reso pubbliche. */
export const load: PageServerLoad = async (event) => {
	requireCharacter(event);
	const page = Math.max(1, Number(event.url.searchParams.get('pagina')) || 1);
	const rows = await db
		.select({
			id: schema.giocate.id,
			title: schema.giocate.title,
			locationName: schema.giocate.locationName,
			fromAt: schema.giocate.fromAt,
			participants: schema.giocate.participantIds
		})
		.from(schema.giocate)
		.where(eq(schema.giocate.isPublic, true))
		.orderBy(desc(schema.giocate.fromAt))
		.limit(PAGE + 1)
		.offset((page - 1) * PAGE);
	return {
		page,
		hasMore: rows.length > PAGE,
		giocate: rows.slice(0, PAGE).map((g) => ({ id: g.id, title: g.title, locationName: g.locationName, fromAt: g.fromAt.toISOString(), people: g.participants.length }))
	};
};
