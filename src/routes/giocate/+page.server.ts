import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { listForUser } from '#lib/server/giocate.ts';

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	return { giocate: await listForUser(user.id) };
};
