import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';

/** Spazio dei Master: serve almeno uno dei permessi da Master. */
export const load: LayoutServerLoad = (event) => {
	const { user } = requireUser(event);
	const can = { esiti: user.capabilities.has('esiti.manage'), giocate: user.capabilities.has('giocate.review') };
	if (!can.esiti && !can.giocate) error(403, 'Questo spazio è riservato ai Master.');
	return { masterCan: can };
};
