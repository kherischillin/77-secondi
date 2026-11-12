import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { loginSchema } from '#lib/validation.ts';
import { findUserForLogin, isBanned } from '#lib/server/users.ts';
import { getDummyHash, hashPassword, needsRehash, verifyPassword } from '#lib/server/auth/password.ts';
import { createSession, generateSessionToken, setSessionCookie } from '#lib/server/auth/session.ts';
import { loginIpLimiter, loginLimiter } from '#lib/server/rate-limit.ts';
import { audit } from '#lib/server/audit.ts';
import { clientIp, safeRedirectTarget } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';

const GENERIC_ERROR = 'Nome utente o password non corretti.';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirectTarget(url.searchParams.get('dopo')));
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies, url } = event;
		const form = await request.formData();
		const raw = {
			username: String(form.get('username') ?? ''),
			password: String(form.get('password') ?? '')
		};
		const values = { username: raw.username };

		const parsed = loginSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { error: GENERIC_ERROR, values });
		}

		const ip = clientIp(event) ?? 'sconosciuto';
		const key = `${ip}|${parsed.data.username.toLowerCase()}`;
		if (loginLimiter.isLimited(key) || loginIpLimiter.isLimited(ip)) {
			const wait = Math.max(loginLimiter.retryAfter(key), loginIpLimiter.retryAfter(ip));
			const minutes = Math.max(1, Math.ceil(wait / 60));
			return fail(429, {
				error: `Troppi tentativi falliti. Riprova tra ${minutes} minut${minutes === 1 ? 'o' : 'i'}.`,
				values
			});
		}

		const user = await findUserForLogin(parsed.data.username);
		// Si verifica sempre una password, anche se l'utente non esiste, per non rivelarlo dai tempi di risposta.
		const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), parsed.data.password);

		if (!user || !valid) {
			loginLimiter.hit(key);
			loginIpLimiter.hit(ip);
			await audit({
				actorUserId: user?.id ?? null,
				action: 'auth.login_failed',
				details: { tentativo: parsed.data.username.slice(0, 60) },
				ip
			});
			return fail(400, { error: GENERIC_ERROR, values });
		}

		loginLimiter.reset(key);

		// Account importato da GDRCD: la vecchia password diventa subito un hash moderno.
		if (needsRehash(user.passwordHash)) {
			await db.update(schema.users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(schema.users.id, user.id));
		}

		if (isBanned(user)) {
			return fail(403, {
				error: `Account sospeso fino al ${user.bannedUntil!.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}${user.banReason ? `: ${user.banReason}` : '.'}`,
				values
			});
		}

		const token = generateSessionToken();
		const session = await createSession(token, user.id, {
			ip,
			userAgent: request.headers.get('user-agent')
		});
		setSessionCookie(cookies, token, session.expiresAt);
		await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
		await audit({ actorUserId: user.id, action: 'auth.login', ip });

		redirect(303, safeRedirectTarget(url.searchParams.get('dopo')));
	}
};
