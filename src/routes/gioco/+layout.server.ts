import type { LayoutServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { getPresence } from '#lib/server/presence.ts';

export const load: LayoutServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const presence = await getPresence(character.id);
	return { playing: character, currentMapId: presence?.mapId ?? null };
};
