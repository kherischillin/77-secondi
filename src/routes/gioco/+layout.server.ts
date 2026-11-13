import type { LayoutServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';

export const load: LayoutServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	return { playing: character };
};
