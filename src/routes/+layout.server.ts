import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { unreadCount } from '#lib/server/messages.ts';
import { masterPendingCount, playerUnreadCount } from '#lib/server/esiti.ts';
import { pendingReviewCount } from '#lib/server/giocate.ts';
import { openReportsCount } from '#lib/server/reports.ts';
import { footerPages } from '#lib/server/pages.ts';
import { getPresence } from '#lib/server/presence.ts';
import { isRoomsOnlyMap } from '#lib/server/rooms.ts';
import { getStartMap } from '#lib/server/world.ts';
import { isTheme } from '#lib/themes.ts';
import { readNotify } from '#lib/notify.ts';
import { allowedWithoutCharacter } from '#lib/navigation.ts';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const user = locals.user;
	// Dopo l'accesso si sceglie il personaggio prima di tutto il resto.
	if (user && !locals.character && !allowedWithoutCharacter(url.pathname)) redirect(303, '/scegli-personaggio');

	const caps = user?.capabilities;
	const isMaster = !!caps && (caps.has('esiti.manage') || caps.has('giocate.review'));
	const [unreadMessages, esitiUnread, masterEsiti, masterGiocate, reportsOpen, presence] = await Promise.all([
		locals.character ? unreadCount(locals.character.id) : 0,
		locals.character ? playerUnreadCount(locals.character.id) : 0,
		user && caps?.has('esiti.manage') ? masterPendingCount(user.id) : 0,
		caps?.has('giocate.review') ? pendingReviewCount() : 0,
		caps?.has('reports.handle') ? openReportsCount() : 0,
		locals.character ? getPresence(locals.character.id) : null
	]);
	// Dentro una stanza privata (o nella mappa che le raccoglie) la voce Mappa porta alla mappa principale.
	let currentMapId = presence?.mapId ?? null;
	if (currentMapId && (await isRoomsOnlyMap(currentMapId))) currentMapId = (await getStartMap())?.id ?? currentMapId;
	return {
		unreadMessages,
		esitiUnread,
		masterPending: isMaster ? masterEsiti + masterGiocate : null,
		reportsOpen,
		/** La voce "Mappa" porta alla mappa in cui si trova il personaggio. */
		currentMapId,
		notify: readNotify(user?.notify),
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
