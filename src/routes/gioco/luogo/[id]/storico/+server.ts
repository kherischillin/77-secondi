import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolvePlayableLocation } from '#lib/server/game-context.ts';
import { loadHistory } from '#lib/server/chat-service.ts';

/** Messaggi precedenti a un certo id ("Carica messaggi precedenti"). */
export const GET: RequestHandler = async (event) => {
	const ctx = await resolvePlayableLocation(event);
	if ('error' in ctx) return new Response(null, { status: ctx.error });
	// Chat fresca: i messaggi più vecchi li possono caricare solo moderatori e amministratori.
	if (!ctx.canModerate) return new Response(null, { status: 403 });

	const before = Number(event.url.searchParams.get('prima'));
	const history = await loadHistory(
		ctx.location.id,
		{ characterId: ctx.character.id, canModerate: ctx.canModerate, since: ctx.since },
		Number.isInteger(before) && before > 0 ? before : undefined
	);
	return json(history);
};
