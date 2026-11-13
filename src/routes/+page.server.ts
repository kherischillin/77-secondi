import { and, count, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db, schema } from '#lib/server/db/index.ts';
import { getHome } from '#lib/server/settings.ts';
import { listNews, toNewsView } from '#lib/server/news.ts';
import { listOnline } from '#lib/server/presence.ts';
import { getStartMap } from '#lib/server/world.ts';
import { mediaUrl } from '#lib/server/uploads.ts';
import { weatherFor } from '#lib/weather.ts';

/** Pagina iniziale: benvenuto, presenti, accesso, stato della città e news. */
export const load: PageServerLoad = async ({ locals }) => {
	const [home, news, online, startMap, [chars], [guilds]] = await Promise.all([
		getHome(),
		listNews({ publishedOnly: true, limit: 8 }),
		listOnline(),
		getStartMap(),
		db.select({ n: count() }).from(schema.characters).where(isNull(schema.characters.deletedAt)),
		db.select({ n: count() }).from(schema.guilds).where(and(eq(schema.guilds.isActive, true)))
	]);

	// Dove si gioca adesso: i luoghi pubblici con più presenti (le stanze private non si mostrano).
	const busy = new Map<number, { name: string; mapName: string | null; present: number }>();
	for (const c of online) {
		if (!c.locationId || c.locationPrivate || !c.locationName) continue;
		const row = busy.get(c.locationId) ?? { name: c.locationName, mapName: c.mapName ?? null, present: 0 };
		row.present++;
		busy.set(c.locationId, row);
	}
	const hotspots = [...busy.entries()]
		.sort((a, b) => b[1].present - a[1].present || a[1].name.localeCompare(b[1].name))
		.slice(0, 4)
		.map(([id, r]) => ({ id, ...r }));

	const weather = startMap ? weatherFor(startMap, new Date()) : null;
	return {
		home: { chapter: home.chapter, welcomeTitle: home.welcomeTitle, welcomeText: home.welcomeText, presentLine: home.presentLine, backgroundUrl: mediaUrl(home.background) },
		news: news.map(toNewsView),
		stats: { online: online.length, characters: Number(chars?.n ?? 0), guilds: Number(guilds?.n ?? 0) },
		city: startMap ? { name: startMap.name, weather } : null,
		hotspots,
		registrationsOpen: locals.settings.registrationsOpen,
		canManageHome: locals.user?.capabilities.has('home.manage') ?? false
	};
};
