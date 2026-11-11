import { fail } from '@sveltejs/kit';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { audit } from '#lib/server/audit.ts';

const boardSchema = z
	.object({
		name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(60),
		description: z.string().trim().max(300, 'Descrizione troppo lunga.'),
		section: z.enum(['on', 'off']),
		visibility: z.enum(['all', 'guild', 'staff']),
		guildId: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().positive().nullable()),
		staffOnlyThreads: z.boolean(),
		sortOrder: z.coerce.number().int().min(-1000).max(1000)
	})
	.refine((b) => b.visibility !== 'guild' || b.guildId !== null, { message: 'Scegli la gilda a cui è riservata la bacheca.' })
	.transform((b) => ({ ...b, guildId: b.visibility === 'guild' ? b.guildId : null }));

function readBoard(form: FormData) {
	return boardSchema.safeParse({
		name: String(form.get('name') ?? ''),
		description: String(form.get('description') ?? ''),
		section: String(form.get('section') ?? 'off'),
		visibility: String(form.get('visibility') ?? 'all'),
		guildId: form.get('guildId'),
		staffOnlyThreads: form.get('staffOnlyThreads') === 'on',
		sortOrder: form.get('sortOrder') || 0
	});
}

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'boards.manage');
	const [boards, guilds] = await Promise.all([
		db
			.select({
				board: schema.boards,
				threads: sql<number>`(select count(*)::int from ${schema.boardThreads} t where t.board_id = ${schema.boards.id})`
			})
			.from(schema.boards)
			.orderBy(asc(schema.boards.sortOrder), asc(schema.boards.name)),
		db.select({ id: schema.guilds.id, name: schema.guilds.name }).from(schema.guilds).orderBy(asc(schema.guilds.name))
	]);
	return { boards: boards.map((b) => ({ ...b.board, threads: b.threads, createdAt: b.board.createdAt.toISOString() })), guilds };
};

export const actions: Actions = {
	crea: async (event) => {
		const { user } = requireCapability(event, 'boards.manage');
		const parsed = readBoard(await event.request.formData());
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		const [board] = await db.insert(schema.boards).values(parsed.data).returning();
		await audit({ actorUserId: user.id, action: 'board.create', targetType: 'board', targetId: board.id, details: { nome: board.name }, ip: clientIp(event) });
		return { success: `Bacheca «${board.name}» creata.` };
	},

	salva: async (event) => {
		const { user } = requireCapability(event, 'boards.manage');
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const parsed = readBoard(form);
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		await db.update(schema.boards).set(parsed.data).where(eq(schema.boards.id, id));
		await audit({ actorUserId: user.id, action: 'board.update', targetType: 'board', targetId: id, details: parsed.data, ip: clientIp(event) });
		return { success: `Bacheca «${parsed.data.name}» salvata.` };
	},

	elimina: async (event) => {
		const { user } = requireCapability(event, 'boards.manage');
		const id = Number((await event.request.formData()).get('id'));
		const [board] = await db.delete(schema.boards).where(eq(schema.boards.id, id)).returning();
		if (board) await audit({ actorUserId: user.id, action: 'board.delete', targetType: 'board', targetId: id, details: { nome: board.name }, ip: clientIp(event) });
		return { success: 'Bacheca eliminata.' };
	}
};
