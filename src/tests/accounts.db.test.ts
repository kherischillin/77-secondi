import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDatabase, hasTestDb, makeCharacter, makeUser, outcomes } from './db.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { UserExistsError, countAdmins, createUser, findUserForLogin, setUserRoles } from '#lib/server/users.ts';
import { verifyPassword } from '#lib/server/auth/password.ts';
import {
	createSession,
	deleteExpiredSessions,
	generateSessionToken,
	hashToken,
	invalidateUserSessions,
	setActiveCharacter,
	validateSessionToken
} from '#lib/server/auth/session.ts';
import { CharacterError, createCharacter, softDeleteCharacter } from '#lib/server/characters.ts';
import { requireCapability, requireCharacter, requireUser } from '#lib/server/guards.ts';
import { canActOnUser, canAssignRole } from '#lib/server/admin-rules.ts';
import { ALL_CAPABILITIES } from '#lib/permissions.ts';
import { claimXpAward, endQuest, startQuest } from '#lib/server/quests.ts';
import { load as gestioneLoad } from '../routes/gestione/+page.server.ts';

/** Apre una sessione vera e prepara una richiesta finta, come farebbe hooks.server.ts. */
async function eventFor(userId: number, path = '/gestione') {
	const token = generateSessionToken();
	await createSession(token, userId);
	const result = await validateSessionToken(token);
	return {
		token,
		event: {
			locals: { user: result!.user, session: result!.session, character: result!.character },
			url: new URL(`http://localhost${path}`)
		} as unknown as Parameters<typeof requireUser>[0]
	};
}

/** L'errore o il reindirizzamento lanciato da una guardia. */
function thrown(fn: () => unknown): { status?: number; location?: string } {
	try {
		fn();
	} catch (e) {
		return e as { status?: number; location?: string };
	}
	return {};
}

describe.skipIf(!hasTestDb)('account, sessioni e permessi (con database)', () => {
	let admin: Awaited<ReturnType<typeof makeUser>>;
	let player: Awaited<ReturnType<typeof makeUser>>;

	beforeAll(async () => {
		await freshDatabase();
		// Cinque iscrizioni nello stesso istante su un gioco vuoto: un solo Amministratore.
		await Promise.all(['Primo', 'Secondo', 'Terzo', 'Quarto', 'Quinto'].map((n) => makeUser(n)));
		const [first] = await db.select().from(schema.users).orderBy(schema.users.id).limit(1);
		admin = { ...first, isFirstUser: true };
		player = await makeUser('Giocatrice');
	});

	describe('iscrizione', () => {
		it('solo il primo account diventa Amministratore, anche con iscrizioni simultanee', async () => {
			expect(await countAdmins()).toBe(1);
			expect(player.isFirstUser).toBe(false);
		});

		it('gli altri ricevono il ruolo base, senza permessi', async () => {
			const { event } = await eventFor(player.id);
			expect(event.locals.user!.roles).toEqual(['Giocatore']);
			expect(event.locals.user!.capabilities.size).toBe(0);
		});

		it('nome utente ed email sono unici senza distinguere le maiuscole', async () => {
			const base = { password: 'Password-di-prova-77' };
			await expect(createUser({ ...base, username: 'GIOCATRICE', email: 'altra@esempio.test' })).rejects.toMatchObject({ field: 'username' });
			await expect(createUser({ ...base, username: 'Nuova', email: 'Giocatrice@Esempio.Test' })).rejects.toMatchObject({ field: 'email' });
			await expect(createUser({ ...base, username: 'GIOCATRICE', email: 'altra@esempio.test' })).rejects.toBeInstanceOf(UserExistsError);
		});

		it('due iscrizioni simultanee con lo stesso nome: ne passa una sola', async () => {
			const result = await outcomes(
				Array.from({ length: 4 }, (_, i) => createUser({ username: 'Doppione', email: `doppione${i}@esempio.test`, password: 'Password-di-prova-77' }))
			);
			expect(result.ok).toBe(1);
		});

		it('la password è salvata come hash Argon2, mai in chiaro', async () => {
			const [row] = await db.select().from(schema.users).where(eq(schema.users.id, player.id));
			expect(row.passwordHash).toMatch(/^\$argon2id\$/);
			expect(await verifyPassword(row.passwordHash, 'Password-di-prova-77')).toBe(true);
			expect(await verifyPassword(row.passwordHash, 'password-sbagliata')).toBe(false);
		});

		it('si entra con nome utente, email o nome del personaggio', async () => {
			const u = await makeUser('Accedente');
			await makeCharacter(u.id, { name: 'Volto' });
			expect((await findUserForLogin('accedente'))?.id).toBe(u.id);
			expect((await findUserForLogin('ACCEDENTE@esempio.test'))?.id).toBe(u.id);
			expect((await findUserForLogin('volto'))?.id).toBe(u.id);
			expect(await findUserForLogin('nessuno')).toBeNull();
		});
	});

	describe('sessioni', () => {
		it('nel database c’è solo l’hash del token, e un token inventato non vale', async () => {
			const token = generateSessionToken();
			await createSession(token, player.id);
			const rows = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.userId, player.id));
			expect(rows.map((r) => r.id)).toContain(hashToken(token));
			expect(rows.map((r) => r.id)).not.toContain(token);
			expect(await validateSessionToken(generateSessionToken())).toBeNull();
			// Nemmeno l'hash rubato dal database funziona come token.
			expect(await validateSessionToken(hashToken(token))).toBeNull();
		});

		it('una sessione scaduta non vale più e viene cancellata', async () => {
			const token = generateSessionToken();
			await createSession(token, player.id);
			await db.update(schema.sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.sessions.id, hashToken(token)));
			expect(await validateSessionToken(token)).toBeNull();
			expect(await db.select().from(schema.sessions).where(eq(schema.sessions.id, hashToken(token)))).toHaveLength(0);
		});

		it('la pulizia periodica toglie solo le sessioni scadute', async () => {
			const u = await makeUser();
			const alive = generateSessionToken();
			const dead = generateSessionToken();
			await createSession(alive, u.id);
			await createSession(dead, u.id);
			await db.update(schema.sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.sessions.id, hashToken(dead)));
			await deleteExpiredSessions();
			const left = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.userId, u.id));
			expect(left.map((r) => r.id)).toEqual([hashToken(alive)]);
		});

		it('chiudere tutte le sessioni di un account le invalida subito', async () => {
			const u = await makeUser();
			const token = generateSessionToken();
			await createSession(token, u.id);
			expect(await validateSessionToken(token)).not.toBeNull();
			await invalidateUserSessions(u.id);
			expect(await validateSessionToken(token)).toBeNull();
		});

		it('non si può giocare con il personaggio di un altro account, né con uno cancellato', async () => {
			const other = await makeUser();
			const theirs = await makeCharacter(other.id);
			const mine = await makeCharacter(player.id);
			const token = generateSessionToken();
			const session = await createSession(token, player.id);

			await setActiveCharacter(session.id, mine.id);
			expect((await validateSessionToken(token))!.character?.id).toBe(mine.id);

			await setActiveCharacter(session.id, theirs.id);
			expect((await validateSessionToken(token))!.character).toBeNull();

			await setActiveCharacter(session.id, mine.id);
			await softDeleteCharacter(mine.id);
			expect((await validateSessionToken(token))!.character).toBeNull();
		});

		it('togliere un ruolo toglie i permessi dalla richiesta successiva', async () => {
			const u = await makeUser();
			const [moderator] = await db.select().from(schema.roles).where(eq(schema.roles.name, 'Moderatore'));
			await setUserRoles(u.id, [moderator.id]);
			const token = generateSessionToken();
			await createSession(token, u.id);
			expect((await validateSessionToken(token))!.user.capabilities.has('users.manage')).toBe(true);
			await setUserRoles(u.id, []);
			expect((await validateSessionToken(token))!.user.capabilities.size).toBe(0);
		});
	});

	describe('guardie delle pagine', () => {
		it('chi non è entrato viene mandato alla pagina di accesso, con il ritorno', () => {
			const event = { locals: { user: null, session: null, character: null }, url: new URL('http://localhost/banca?x=1') } as unknown as Parameters<typeof requireUser>[0];
			expect(thrown(() => requireUser(event))).toMatchObject({ status: 303, location: '/accesso?dopo=%2Fbanca%3Fx%3D1' });
		});

		it('un giocatore non entra nella gestione, l’Amministratore sì', async () => {
			const asPlayer = await eventFor(player.id);
			const asAdmin = await eventFor(admin.id);
			expect(thrown(() => requireCapability(asPlayer.event, 'admin.access'))).toMatchObject({ status: 403 });
			expect(requireCapability(asAdmin.event, 'admin.access').user.id).toBe(admin.id);
			expect([...asAdmin.event.locals.user!.capabilities].sort()).toEqual([...ALL_CAPABILITIES].sort());
		});

		it('la pagina iniziale della gestione rifiuta da sola chi non ha il permesso', async () => {
			const asPlayer = await eventFor(player.id);
			const asAdmin = await eventFor(admin.id);
			await expect(gestioneLoad(asPlayer.event as never)).rejects.toMatchObject({ status: 403 });
			const data = (await gestioneLoad(asAdmin.event as never)) as { stats: { users: number } };
			expect(data.stats.users).toBeGreaterThan(5);
		});

		it('un account sospeso viene mandato alla pagina di sospensione, finché dura', async () => {
			const u = await makeUser();
			await db.update(schema.users).set({ bannedUntil: new Date(Date.now() + 3_600_000) }).where(eq(schema.users.id, u.id));
			const banned = await eventFor(u.id);
			expect(thrown(() => requireUser(banned.event))).toMatchObject({ status: 303, location: '/sospeso' });
			await db.update(schema.users).set({ bannedUntil: new Date(Date.now() - 1000) }).where(eq(schema.users.id, u.id));
			const free = await eventFor(u.id);
			expect(requireUser(free.event).user.id).toBe(u.id);
		});

		it('senza personaggio attivo non si entra in gioco', async () => {
			const { event } = await eventFor(player.id, '/gioco');
			expect(thrown(() => requireCharacter(event))).toMatchObject({ status: 303, location: '/scegli-personaggio' });
		});
	});

	describe('regole anti-abuso con i ruoli veri', () => {
		it('un Moderatore non può toccare l’Amministratore né assegnarne il ruolo', async () => {
			const mod = await makeUser();
			const roles = await db.select().from(schema.roles);
			const moderatorRole = roles.find((r) => r.name === 'Moderatore')!;
			const adminRole = roles.find((r) => r.isSystem)!;
			const playerRole = roles.find((r) => r.isDefault)!;
			await setUserRoles(mod.id, [moderatorRole.id]);
			const asMod = (await eventFor(mod.id)).event.locals.user!;
			const asAdmin = (await eventFor(admin.id)).event.locals.user!;
			const asPlayer = (await eventFor(player.id)).event.locals.user!;

			expect(canActOnUser(asMod, asAdmin)).toBe(false);
			expect(canActOnUser(asMod, asPlayer)).toBe(true);
			expect(canActOnUser(asAdmin, asMod)).toBe(true);
			expect(canActOnUser(asAdmin, asAdmin)).toBe(false);
			expect(canAssignRole(asMod.capabilities, adminRole)).toBe(false);
			expect(canAssignRole(asMod.capabilities, playerRole)).toBe(true);
		});
	});

	describe('personaggi', () => {
		it('il limite di personaggi regge anche con richieste simultanee', async () => {
			const u = await makeUser();
			const result = await outcomes(Array.from({ length: 6 }, (_, i) => createCharacter(u.id, 2, { name: `Clone${i}`, surname: null, bio: null })));
			expect(result.ok).toBe(2);
			expect(result.errors.every((e) => e instanceof CharacterError)).toBe(true);
		});

		it('un nome resta riservato anche dopo la cancellazione del personaggio', async () => {
			const u = await makeUser();
			const c = await makeCharacter(u.id, { name: 'Irripetibile' });
			await softDeleteCharacter(c.id);
			await expect(createCharacter(u.id, 5, { name: 'IRRIPETIBILE', surname: null, bio: null })).rejects.toBeInstanceOf(CharacterError);
		});
	});

	describe('punti esperienza delle quest', () => {
		it('i PX di una quest si assegnano una volta sola, e solo a quest finita', async () => {
			const master = await makeCharacter(admin.id);
			const [location] = await db.select({ id: schema.locations.id }).from(schema.locations).where(eq(schema.locations.kind, 'chat')).limit(1);
			const quest = await startQuest(location.id, 'Quest di prova', admin.id, master.id);
			expect(await claimXpAward(quest.id)).toBe(false);
			await endQuest(quest.id);
			const claims = await Promise.all(Array.from({ length: 5 }, () => claimXpAward(quest.id)));
			expect(claims.filter(Boolean)).toHaveLength(1);
		});
	});
});
