import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteSessionCookie, invalidateSession } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/audit.ts';
import { clientIp } from '#lib/server/guards.ts';

// L'uscita avviene solo con un POST (dal pulsante "Esci"): un link esterno non può disconnetterti.
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async (event) => {
		const { locals, cookies } = event;
		if (locals.session) {
			await invalidateSession(locals.session.id);
			await audit({ actorUserId: locals.user?.id, action: 'auth.logout', ip: clientIp(event) });
		}
		deleteSessionCookie(cookies);
		redirect(303, '/');
	}
};
