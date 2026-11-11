import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { getPresence } from '#lib/server/presence.ts';
import { getLocation, getMap, getStartMap } from '#lib/server/world.ts';

/** Ingresso in gioco: si torna dove si era rimasti, altrimenti alla mappa di partenza. */
export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const presence = await getPresence(character.id);

	if (presence?.locationId) {
		const location = await getLocation(presence.locationId);
		if (location?.isActive && location.kind === 'chat') redirect(303, `/gioco/luogo/${location.id}`);
	}
	if (presence?.mapId && (await getMap(presence.mapId))) {
		redirect(303, `/gioco/mappa/${presence.mapId}`);
	}
	const start = await getStartMap();
	if (start) redirect(303, `/gioco/mappa/${start.id}`);

	return { canBuild: event.locals.user?.capabilities.has('world.manage') ?? false };
};
