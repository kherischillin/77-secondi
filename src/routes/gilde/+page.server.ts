import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { listGuilds, membershipsOf } from '#lib/server/guilds.ts';

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	const character = event.locals.character;
	return {
		guilds: await listGuilds(),
		mine: character ? (await membershipsOf(character.id)).map((m) => m.guildId) : [],
		canManage: user.capabilities.has('guilds.manage')
	};
};
