import { fail, redirect } from '@sveltejs/kit';
import { asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { audit } from '#lib/server/audit.ts';

const roleNameSchema = z
	.string()
	.trim()
	.min(2, 'Il nome deve avere almeno 2 caratteri.')
	.max(40, 'Il nome può avere al massimo 40 caratteri.');

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'roles.manage');
	const roles = await db
		.select({
			id: schema.roles.id,
			name: schema.roles.name,
			description: schema.roles.description,
			capabilities: schema.roles.capabilities,
			isSystem: schema.roles.isSystem,
			isDefault: schema.roles.isDefault,
			members: sql<number>`(select count(*)::int from ${schema.userRoles} ur where ur.role_id = ${schema.roles.id})`
		})
		.from(schema.roles)
		.orderBy(asc(schema.roles.name));
	return { roles };
};

export const actions: Actions = {
	crea: async (event) => {
		const { user } = requireCapability(event, 'roles.manage');
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '');
		const parsed = roleNameSchema.safeParse(name);
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message, name });

		const [exists] = await db
			.select({ id: schema.roles.id })
			.from(schema.roles)
			.where(sql`lower(${schema.roles.name}) = lower(${parsed.data})`);
		if (exists) return fail(400, { error: 'Esiste già un ruolo con questo nome.', name });

		const [role] = await db.insert(schema.roles).values({ name: parsed.data }).returning();
		await audit({
			actorUserId: user.id,
			action: 'role.create',
			targetType: 'role',
			targetId: role.id,
			details: { nome: role.name },
			ip: clientIp(event)
		});
		redirect(303, `/gestione/ruoli/${role.id}`);
	}
};
