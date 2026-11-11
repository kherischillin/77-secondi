import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { listOnline } from '#lib/server/presence.ts';

export const load: PageServerLoad = async (event) => {
	requireCharacter(event);
	const online = await listOnline();

	// Raggruppati per luogo; chi è sulla mappa finisce in "In giro".
	const groups = new Map<string, { title: string; href: string | null; people: typeof online }>();
	for (const c of online) {
		const key = c.locationId ? `l${c.locationId}` : 'giro';
		if (!groups.has(key)) {
			groups.set(key, {
				title: c.locationName ? `${c.locationName}${c.mapName ? ` · ${c.mapName}` : ''}` : 'In giro per le mappe',
				href: c.locationId ? `/gioco/luogo/${c.locationId}` : null,
				people: []
			});
		}
		groups.get(key)!.people.push(c);
	}
	return {
		total: online.length,
		groups: [...groups.values()].sort((a, b) => (a.href === null ? 1 : b.href === null ? -1 : a.title.localeCompare(b.title)))
	};
};
