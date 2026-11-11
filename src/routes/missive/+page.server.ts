import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { listThreads } from '#lib/server/messages.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const archived = event.url.searchParams.has('archivio');
	return { archived, threads: await listThreads(character.id, archived), me: character };
};
