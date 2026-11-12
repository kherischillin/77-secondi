import type { LayoutServerLoad } from './$types';
import { unreadCount } from '#lib/server/messages.ts';
import { masterPendingCount, playerUnreadCount } from '#lib/server/esiti.ts';
import { pendingReviewCount } from '#lib/server/giocate.ts';
import { openReportsCount } from '#lib/server/reports.ts';
import { footerPages } from '#lib/server/pages.ts';
import { isTheme } from '#lib/themes.ts';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;
	const caps = user?.capabilities;
	const isMaster = !!caps && (caps.has('esiti.manage') || caps.has('giocate.review'));
	const [unreadMessages, esitiUnread, masterEsiti, masterGiocate, reportsOpen] = await Promise.all([
		locals.character ? unreadCount(locals.character.id) : 0,
		locals.character ? playerUnreadCount(locals.character.id) : 0,
		user && caps?.has('esiti.manage') ? masterPendingCount(user.id) : 0,
		caps?.has('giocate.review') ? pendingReviewCount() : 0,
		caps?.has('reports.handle') ? openReportsCount() : 0
	]);
	return {
		unreadMessages,
		esitiUnread,
		masterPending: isMaster ? masterEsiti + masterGiocate : null,
		reportsOpen,
		siteName: locals.settings.siteName,
		siteTagline: locals.settings.siteTagline,
		customCss: locals.settings.customCss.length > 0,
		theme: isTheme(user?.theme) ? user.theme : locals.settings.theme,
		footerPages: await footerPages(!!user),
		user: user
			? {
					username: user.username,
					capabilities: [...user.capabilities]
				}
			: null,
		character: locals.character
	};
};
