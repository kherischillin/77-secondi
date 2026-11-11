import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { audit } from '#lib/server/audit.ts';
import { CAPABILITY_GROUPS, normalizeCapabilities } from '#lib/permissions.ts';
import { isSubset } from '#lib/server/admin-rules.ts';

async function loadRole(idParam: string) {
	const id = Number(idParam);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Ruolo non trovato.');
	const [role] = await db.select().from(schema.roles).where(eq(schema.roles.id, id));
	if (!role) error(404, 'Ruolo non trovato.');
	return role;
}

const roleSchema = z.object({
	name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(40),
	description: z.string().trim().max(200, 'Descrizione troppo lunga.'),
	isDefault: z.boolean()
});

export const load: PageServerLoad = async (event) => {
	const { user } = requireCapability(event, 'roles.manage');
	const role = await loadRole(event.params.id);
	const [{ members }] = await db
		.select({ members: sql<number>`count(*)::int` })
		.from(schema.userRoles)
		.where(eq(schema.userRoles.roleId, role.id));

	return {
		role: {
			id: role.id,
			name: role.name,
			description: role.description,
			capabilities: role.capabilities,
			isSystem: role.isSystem,
			isDefault: role.isDefault
		},
		members,
		groups: CAPABILITY_GROUPS.map((g) => ({
			label: g.label,
			capabilities: Object.entries(g.capabilities).map(([key, label]) => ({
				key,
				label,
				// Si possono concedere solo permessi che si possiedono.
				grantable: user.capabilities.has(key)
			}))
		})),
		editable: !role.isSystem && isSubset(role.capabilities, user.capabilities)
	};
};

export const actions: Actions = {
	salva: async (event) => {
		const { user } = requireCapability(event, 'roles.manage');
		const role = await loadRole(event.params.id);
		if (role.isSystem) return fail(400, { error: 'Il ruolo di sistema non si può modificare.' });
		if (!isSubset(role.capabilities, user.capabilities)) {
			return fail(403, { error: 'Questo ruolo ha permessi che tu non hai: non puoi modificarlo.' });
		}

		const form = await event.request.formData();
		const parsed = roleSchema.safeParse({
			name: String(form.get('name') ?? ''),
			description: String(form.get('description') ?? ''),
			isDefault: form.get('isDefault') === 'on'
		});
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });

		const capabilities = normalizeCapabilities(form.getAll('capabilities').map(String));
		if (!isSubset(capabilities, user.capabilities)) {
			return fail(403, { error: 'Non puoi concedere permessi che non possiedi.' });
		}

		const [clash] = await db
			.select({ id: schema.roles.id })
			.from(schema.roles)
			.where(and(sql`lower(${schema.roles.name}) = lower(${parsed.data.name})`, ne(schema.roles.id, role.id)));
		if (clash) return fail(400, { error: 'Esiste già un ruolo con questo nome.' });

		await db
			.update(schema.roles)
			.set({ ...parsed.data, capabilities })
			.where(eq(schema.roles.id, role.id));
		await audit({
			actorUserId: user.id,
			action: 'role.update',
			targetType: 'role',
			targetId: role.id,
			details: { nome: parsed.data.name, permessi: capabilities },
			ip: clientIp(event)
		});
		return { success: 'Ruolo salvato.' };
	},

	elimina: async (event) => {
		const { user } = requireCapability(event, 'roles.manage');
		const role = await loadRole(event.params.id);
		if (role.isSystem) return fail(400, { error: 'Il ruolo di sistema non si può eliminare.' });
		if (!isSubset(role.capabilities, user.capabilities)) {
			return fail(403, { error: 'Questo ruolo ha permessi che tu non hai: non puoi eliminarlo.' });
		}
		await db.delete(schema.roles).where(eq(schema.roles.id, role.id));
		await audit({
			actorUserId: user.id,
			action: 'role.delete',
			targetType: 'role',
			targetId: role.id,
			details: { nome: role.name },
			ip: clientIp(event)
		});
		redirect(303, '/gestione/ruoli');
	}
};
