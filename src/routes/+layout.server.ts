import type { LayoutServerLoad } from './$types';
import { unreadCount } from '#lib/server/messages.ts';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		unreadMessages: locals.character ? await unreadCount(locals.character.id) : 0,
		siteName: locals.settings.siteName,
		siteTagline: locals.settings.siteTagline,
		user: locals.user
			? {
					username: locals.user.username,
					capabilities: [...locals.user.capabilities]
				}
			: null,
		character: locals.character
	};
};
