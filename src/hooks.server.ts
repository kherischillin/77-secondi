import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { bootstrapDatabase } from '#lib/server/bootstrap.ts';
import { getSettings } from '#lib/server/settings.ts';
import {
	SESSION_COOKIE,
	deleteExpiredSessions,
	deleteSessionCookie,
	setSessionCookie,
	validateSessionToken
} from '#lib/server/auth/session.ts';

/** All'avvio: migrazioni del database, ruoli iniziali e pulizia periodica delle sessioni. */
export const init: ServerInit = async () => {
	await bootstrapDatabase();
	setInterval(
		() => deleteExpiredSessions().catch((e) => console.error(e)),
		60 * 60 * 1000
	).unref();
	console.log('Database pronto.');
};

/** Eseguito a ogni richiesta: riconosce l'utente dal cookie e aggiunge intestazioni di sicurezza. */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.settings = await getSettings();
	event.locals.user = null;
	event.locals.session = null;
	event.locals.character = null;

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const result = await validateSessionToken(token);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
			event.locals.character = result.character;
			setSessionCookie(event.cookies, token, result.session.expiresAt);
		} else {
			deleteSessionCookie(event.cookies);
		}
	}

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
};
