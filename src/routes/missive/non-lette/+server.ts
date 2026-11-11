import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unreadCount } from '#lib/server/messages.ts';

/** Numero di missive non lette del personaggio attivo (letto periodicamente dall'intestazione). */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.character) return json({ count: 0 });
	return json({ count: await unreadCount(locals.character.id) }, { headers: { 'Cache-Control': 'no-store' } });
};
