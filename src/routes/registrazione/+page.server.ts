import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { registerSchema, fieldErrors } from '#lib/validation.ts';
import { createUser, UserExistsError } from '#lib/server/users.ts';
import { createSession, generateSessionToken, setSessionCookie } from '#lib/server/auth/session.ts';
import { registerLimiter } from '#lib/server/rate-limit.ts';
import { audit } from '#lib/server/audit.ts';
import { clientIp } from '#lib/server/guards.ts';

type FormErrors = Record<string, string>;

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/account');
	return { registrationsOpen: locals.settings.registrationsOpen };
};

export const actions: Actions = {
	default: async (event) => {
		const { request, locals, cookies } = event;
		if (!locals.settings.registrationsOpen) {
			return fail(403, {
				errors: { form: 'Le iscrizioni sono chiuse.' } as FormErrors,
				values: { username: '', email: '' }
			});
		}

		const form = await request.formData();
		const raw = {
			username: String(form.get('username') ?? ''),
			email: String(form.get('email') ?? ''),
			password: String(form.get('password') ?? ''),
			passwordConfirm: String(form.get('passwordConfirm') ?? '')
		};
		const values = { username: raw.username, email: raw.email };

		const ip = clientIp(event) ?? 'sconosciuto';
		if (registerLimiter.isLimited(ip)) {
			return fail(429, {
				errors: { form: 'Troppe iscrizioni da questa connessione. Riprova più tardi.' } as FormErrors,
				values
			});
		}

		const parsed = registerSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { errors: fieldErrors(parsed.error), values });
		}

		let created;
		try {
			created = await createUser(parsed.data);
		} catch (e) {
			if (e instanceof UserExistsError) {
				return fail(400, { errors: { [e.field]: e.message } as FormErrors, values });
			}
			throw e;
		}
		registerLimiter.hit(ip);

		const { user, isFirstUser } = created;
		await audit({
			actorUserId: user.id,
			action: 'auth.register',
			targetType: 'user',
			targetId: user.id,
			details: isFirstUser ? { primoAmministratore: true } : undefined,
			ip
		});

		const token = generateSessionToken();
		const session = await createSession(token, user.id, {
			ip,
			userAgent: request.headers.get('user-agent')
		});
		setSessionCookie(cookies, token, session.expiresAt);

		redirect(303, isFirstUser ? '/account?benvenuto=admin' : '/account?benvenuto=1');
	}
};
