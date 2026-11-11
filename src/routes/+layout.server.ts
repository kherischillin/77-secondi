import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
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
