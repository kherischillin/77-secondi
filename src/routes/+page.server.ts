import type { PageServerLoad } from './$types';
import { getHome } from '#lib/server/settings.ts';
import { listNews, toNewsView } from '#lib/server/news.ts';
import { listOnline } from '#lib/server/presence.ts';
import { mediaUrl } from '#lib/server/uploads.ts';

/** Pagina iniziale: benvenuto, presenti, accesso e news. */
export const load: PageServerLoad = async ({ locals }) => {
	const [home, news, online] = await Promise.all([getHome(), listNews({ publishedOnly: true, limit: 8 }), listOnline()]);

	return {
		home: { chapter: home.chapter, welcomeTitle: home.welcomeTitle, welcomeText: home.welcomeText, presentLine: home.presentLine, backgroundUrl: mediaUrl(home.background) },
		news: news.map(toNewsView),
		online: online.length,
		registrationsOpen: locals.settings.registrationsOpen,
		canManageHome: locals.user?.capabilities.has('home.manage') ?? false
	};
};
