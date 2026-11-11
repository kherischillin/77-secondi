import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';

export const load: PageServerLoad = (event) => {
	const { character } = requireCharacter(event);
	return { playing: character };
};
