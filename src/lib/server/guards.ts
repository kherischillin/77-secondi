import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Capability } from '../permissions';
import { isBanned } from './users';
export { safeRedirectTarget } from '../redirect';

/** Richiede un utente collegato; altrimenti manda alla pagina di accesso. */
export function requireUser(event: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = event.locals.user;
	if (!user || !event.locals.session) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		redirect(303, `/accesso?dopo=${next}`);
	}
	if (isBanned(user)) {
		redirect(303, '/sospeso');
	}
	return { user, session: event.locals.session };
}

/** Richiede una capacità precisa (es. "roles.manage"). */
export function requireCapability(
	event: Pick<RequestEvent, 'locals' | 'url'>,
	capability: Capability
) {
	const ctx = requireUser(event);
	if (!ctx.user.capabilities.has(capability)) {
		error(403, 'Non hai i permessi per questa pagina.');
	}
	return ctx;
}

/** Richiede un personaggio attivo per entrare in gioco. */
export function requireCharacter(event: Pick<RequestEvent, 'locals' | 'url'>) {
	const ctx = requireUser(event);
	const character = event.locals.character;
	if (!character) redirect(303, '/account');
	return { ...ctx, character };
}

export function clientIp(event: Pick<RequestEvent, 'getClientAddress'>): string | null {
	try {
		return event.getClientAddress();
	} catch {
		return null;
	}
}
