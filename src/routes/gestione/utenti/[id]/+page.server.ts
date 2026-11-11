import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { canActOnUser, canAssignRole } from '#lib/server/admin-rules.ts';
import { countAdmins, setUserRoles } from '#lib/server/users.ts';
import { invalidateUserSessions } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/audit.ts';

async function loadTarget(idParam: string) {
	const id = Number(idParam);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Account non trovato.');

	const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
	if (!user) error(404, 'Account non trovato.');

	const roles = await db
		.select({ id: schema.roles.id, name: schema.roles.name, capabilities: schema.roles.capabilities })
		.from(schema.userRoles)
		.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
		.where(eq(schema.userRoles.userId, id));

	return { user, roles, capabilities: new Set(roles.flatMap((r) => r.capabilities)) };
}

export const load: PageServerLoad = async (event) => {
	const { user: actor } = requireCapability(event, 'users.view');
	const target = await loadTarget(event.params.id);

	const [allRoles, characters] = await Promise.all([
		db.select().from(schema.roles).orderBy(asc(schema.roles.name)),
		db
			.select({ id: schema.characters.id, name: schema.characters.name, surname: schema.characters.surname, createdAt: schema.characters.createdAt })
			.from(schema.characters)
			.where(and(eq(schema.characters.userId, target.user.id), isNull(schema.characters.deletedAt)))
			.orderBy(asc(schema.characters.createdAt))
	]);

	const canManage =
		actor.capabilities.has('users.manage') &&
		canActOnUser(actor, { id: target.user.id, capabilities: target.capabilities });

	return {
		target: {
			id: target.user.id,
			username: target.user.username,
			email: target.user.email,
			createdAt: target.user.createdAt.toISOString(),
			lastLoginAt: target.user.lastLoginAt?.toISOString() ?? null,
			bannedUntil:
				target.user.bannedUntil && target.user.bannedUntil.getTime() > Date.now()
					? target.user.bannedUntil.toISOString()
					: null,
			banReason: target.user.banReason,
			roleIds: target.roles.map((r) => r.id)
		},
		characters: characters.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
		roles: allRoles.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description,
			assignable: canAssignRole(actor.capabilities, r)
		})),
		canManage,
		isSelf: actor.id === target.user.id
	};
};

/** Controlli comuni alle azioni: permesso, gerarchia, account esistente. */
async function authorize(event: RequestEvent) {
	const { user: actor } = requireCapability(event, 'users.manage');
	const target = await loadTarget(event.params.id);
	if (!canActOnUser(actor, { id: target.user.id, capabilities: target.capabilities })) {
		error(403, 'Non puoi modificare questo account: ha poteri pari o superiori ai tuoi, oppure è il tuo.');
	}
	return { actor, target };
}

const banSchema = z.object({
	days: z.coerce.number().int().min(1, 'Minimo 1 giorno.').max(3650, 'Massimo 10 anni.'),
	reason: z.string().trim().min(3, 'Indica un motivo.').max(300)
});

export const actions: Actions = {
	ruoli: async (event) => {
		const { actor, target } = await authorize(event);
		const form = await event.request.formData();
		const requested = new Set(form.getAll('roles').map(Number).filter(Number.isInteger));

		const allRoles = await db.select().from(schema.roles);
		const current = new Set(target.roles.map((r) => r.id));

		// Si possono aggiungere o togliere solo ruoli che l'attore potrebbe assegnare;
		// gli altri restano come sono.
		const finalIds = allRoles
			.filter((r) => (canAssignRole(actor.capabilities, r) ? requested.has(r.id) : current.has(r.id)))
			.map((r) => r.id);

		const adminRole = allRoles.find((r) => r.isSystem);
		if (adminRole && current.has(adminRole.id) && !finalIds.includes(adminRole.id)) {
			if ((await countAdmins(target.user.id)) === 0) {
				return fail(400, { action: 'ruoli', error: 'Deve restare almeno un Amministratore.' });
			}
		}

		await setUserRoles(target.user.id, finalIds);
		await audit({
			actorUserId: actor.id,
			action: 'user.roles',
			targetType: 'user',
			targetId: target.user.id,
			details: { ruoli: allRoles.filter((r) => finalIds.includes(r.id)).map((r) => r.name) },
			ip: clientIp(event)
		});
		return { action: 'ruoli', success: 'Ruoli aggiornati.' };
	},

	sospendi: async (event) => {
		const { actor, target } = await authorize(event);
		const form = await event.request.formData();
		const parsed = banSchema.safeParse({ days: form.get('days'), reason: form.get('reason') });
		if (!parsed.success) {
			return fail(400, { action: 'sospendi', error: parsed.error.issues[0].message });
		}

		const until = new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000);
		await db
			.update(schema.users)
			.set({ bannedUntil: until, banReason: parsed.data.reason })
			.where(eq(schema.users.id, target.user.id));
		// Disconnette subito l'account sospeso da tutti i dispositivi.
		await invalidateUserSessions(target.user.id);
		await audit({
			actorUserId: actor.id,
			action: 'user.ban',
			targetType: 'user',
			targetId: target.user.id,
			details: { giorni: parsed.data.days, motivo: parsed.data.reason },
			ip: clientIp(event)
		});
		return { action: 'sospendi', success: 'Account sospeso.' };
	},

	riattiva: async (event) => {
		const { actor, target } = await authorize(event);
		await db
			.update(schema.users)
			.set({ bannedUntil: null, banReason: null })
			.where(eq(schema.users.id, target.user.id));
		await audit({
			actorUserId: actor.id,
			action: 'user.unban',
			targetType: 'user',
			targetId: target.user.id,
			ip: clientIp(event)
		});
		return { action: 'riattiva', success: 'Sospensione revocata.' };
	}
};
