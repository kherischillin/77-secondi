import { isTheme, type ThemeId } from '#lib/themes.ts';

/** Cookie con l'ultimo tema personale usato in questo browser. */
const THEME_COOKIE = 'gdr_tema';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { bootstrapDatabase } from '#lib/server/bootstrap.ts';
import { getSettings } from '#lib/server/settings.ts';
import { messagesMaintenance } from '#lib/server/messages.ts';
import { purgeOldChat } from '#lib/server/chat-service.ts';
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
	// Ogni ora: sessioni scadute, missive lette da cancellare, messaggi eliminati da tutti, chat vecchia.
	const hourly = async () => {
		const settings = await getSettings();
		await deleteExpiredSessions();
		await messagesMaintenance(settings.missiveAutoDeleteDays);
		await purgeOldChat(settings.chatRetentionDays);
	};
	hourly().catch((e) => console.error(e));
	setInterval(() => hourly().catch((e) => console.error(e)), 60 * 60 * 1000).unref();
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

	// Tema grafico: quello scelto dal giocatore, altrimenti quello del sito.
	// Il browser ricorda l'ultimo tema personale usato (cookie), così anche chi non è entrato
	// (pagina iniziale, accesso, iscrizione) vede il tema che usa di solito.
	const remembered = event.cookies.get(THEME_COOKIE);
	let theme: ThemeId;
	if (event.locals.user) {
		const own = isTheme(event.locals.user.theme) ? event.locals.user.theme : null;
		theme = own ?? event.locals.settings.theme;
		if (own && remembered !== own) {
			event.cookies.set(THEME_COOKIE, own, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax', secure: event.url.protocol === 'https:' });
		} else if (!own && remembered) {
			event.cookies.delete(THEME_COOKIE, { path: '/' });
		}
	} else {
		theme = isTheme(remembered) ? remembered : event.locals.settings.theme;
	}
	event.locals.theme = theme;
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%gdr.theme%', theme)
	});
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
};
