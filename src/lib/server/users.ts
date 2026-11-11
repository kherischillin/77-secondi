import { eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from './db';
import { hashPassword } from './auth/password';

export class UserExistsError extends Error {
	readonly field: 'username' | 'email';
	constructor(field: 'username' | 'email') {
		super(field === 'username' ? 'Nome utente già in uso.' : 'Email già registrata.');
		this.field = field;
	}
}

/**
 * Crea un account. Il primo account mai creato diventa Amministratore,
 * gli altri ricevono i ruoli predefiniti (di solito "Giocatore").
 */
export async function createUser(input: { username: string; email: string; password: string }) {
	const passwordHash = await hashPassword(input.password);

	return db.transaction(async (tx) => {
		// Serializza le registrazioni: evita che due "primi utenti" diventino entrambi admin.
		await tx.execute(sql`select pg_advisory_xact_lock(424242)`);

		const clash = await tx
			.select({ username: schema.users.username, email: schema.users.email })
			.from(schema.users)
			.where(
				sql`lower(${schema.users.username}) = lower(${input.username}) or lower(${schema.users.email}) = lower(${input.email})`
			);
		if (clash.length) {
			const sameName = clash.some((c) => c.username.toLowerCase() === input.username.toLowerCase());
			throw new UserExistsError(sameName ? 'username' : 'email');
		}

		const [{ total }] = await tx
			.select({ total: sql<number>`count(*)::int` })
			.from(schema.users);
		const isFirstUser = total === 0;

		const [user] = await tx
			.insert(schema.users)
			.values({ username: input.username, email: input.email, passwordHash })
			.returning();

		const roleRows = await tx
			.select({ id: schema.roles.id })
			.from(schema.roles)
			.where(
				isFirstUser ? eq(schema.roles.isSystem, true) : eq(schema.roles.isDefault, true)
			);
		if (roleRows.length) {
			await tx
				.insert(schema.userRoles)
				.values(roleRows.map((r) => ({ userId: user.id, roleId: r.id })));
		}

		return { user, isFirstUser };
	});
}

export async function findUserForLogin(usernameOrEmail: string) {
	const [user] = await db
		.select()
		.from(schema.users)
		.where(
			sql`lower(${schema.users.username}) = lower(${usernameOrEmail}) or lower(${schema.users.email}) = lower(${usernameOrEmail})`
		)
		.limit(1);
	return user ?? null;
}

/** Quanti utenti hanno il ruolo di sistema (Amministratore) (serve per non restare mai senza). */
export async function countAdmins(excludeUserId?: number): Promise<number> {
	const rows = await db
		.select({ userId: schema.userRoles.userId })
		.from(schema.userRoles)
		.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
		.where(eq(schema.roles.isSystem, true));
	return rows.filter((r) => r.userId !== excludeUserId).length;
}

export async function setUserRoles(userId: number, roleIds: number[]) {
	await db.transaction(async (tx) => {
		await tx.delete(schema.userRoles).where(eq(schema.userRoles.userId, userId));
		if (roleIds.length) {
			const valid = await tx
				.select({ id: schema.roles.id })
				.from(schema.roles)
				.where(inArray(schema.roles.id, roleIds));
			if (valid.length) {
				await tx.insert(schema.userRoles).values(valid.map((r) => ({ userId, roleId: r.id })));
			}
		}
	});
}

export function isBanned(user: { bannedUntil: Date | null }): boolean {
	return !!user.bannedUntil && user.bannedUntil.getTime() > Date.now();
}

