import type { RequestEvent } from '@sveltejs/kit';
import { getLocation } from './world.ts';
import { isBanned } from './users.ts';

/**
 * Per gli endpoint usati dal JavaScript (eventi in tempo reale, storico):
 * invece di reindirizzare alla pagina di accesso restituiscono un codice di errore.
 */
export async function resolvePlayableLocation(event: Pick<RequestEvent, 'locals' | 'params'>) {
	const { user, character } = event.locals;
	if (!user || !character || isBanned(user)) return { error: 401 as const };
	const id = Number((event.params as Record<string, string>).id);
	const location = await getLocation(id);
	if (!location || !location.isActive || location.kind !== 'chat') return { error: 404 as const };
	return { user, character, location, canModerate: user.capabilities.has('chat.moderate') };
}
