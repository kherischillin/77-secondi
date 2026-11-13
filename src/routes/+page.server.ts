import { redirect } from '@sveltejs/kit';
import { getStartMap } from '#lib/server/world.ts';
import type { PageServerLoad } from './$types';
import { getHome } from '#lib/server/settings.ts';
import { listNews, toNewsView } from '#lib/server/news.ts';
import { listOnline } from '#lib/server/presence.ts';
import { mediaUrl } from '#lib/server/uploads.ts';

/** Pagina iniziale: benvenuto, presenti, accesso e news. */
export const load: PageServerLoad = async ({ locals, url }) => {
	// Chi è già entrato non resta sulla pagina iniziale: va alla mappa principale (o a scegliere il personaggio).
	// Lo staff che la gestisce può guardarla con ?anteprima.
	const preview = url.searchParams.has('anteprima') && (locals.user?.capabilities.has('home.manage') ?? false);
	if (locals.user && !preview) {
		if (!locals.character) redirect(303, '/scegli-personaggio');
		const start = await getStartMap();
		redirect(303, start ? `/gioco/mappa/${start.id}` : '/gioco');
	}
	const [home, news, online] = await Promise.all([getHome(), listNews({ publishedOnly: true, limit: 8 }), listOnline()]);

	return {
		home: { chapter: home.chapter, welcomeTitle: home.welcomeTitle, welcomeText: home.welcomeText, presentLine: home.presentLine, backgroundUrl: mediaUrl(home.background) },
		news: news.map(toNewsView),
		online: online.length,
		registrationsOpen: locals.settings.registrationsOpen,
		canManageHome: locals.user?.capabilities.has('home.manage') ?? false
	};
};
