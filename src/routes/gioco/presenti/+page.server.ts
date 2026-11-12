import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { listOnline } from '#lib/server/presence.ts';
import { accessibleRoomIds } from '#lib/server/rooms.ts';

export const load: PageServerLoad = async (event) => {
	const { user, character } = requireCharacter(event);
	const online = await listOnline();
	const canModerate = user.capabilities.has('chat.moderate');
	// Le stanze private in cui si può entrare (prenotate o con invito) si mostrano con nome e collegamento.
	const myRooms = await accessibleRoomIds(character.id, [...new Set(online.filter((c) => c.locationPrivate && c.locationId).map((c) => c.locationId!))]);

	// Raggruppati per luogo; chi è sulla mappa finisce in "In giro".
	const groups = new Map<string, { title: string; href: string | null; people: typeof online }>();
	for (const c of online) {
		// Chi è in una stanza privata non si mostra dove (solo i moderatori lo vedono).
		const hidden = c.locationPrivate && !canModerate && !myRooms.has(c.locationId!);
		const key = hidden ? 'privata' : c.locationId ? `l${c.locationId}` : 'giro';
		if (!groups.has(key)) {
			groups.set(key, {
				title: hidden
					? 'In una stanza privata'
					: c.locationName
						? c.locationPrivate
							? `${c.locationName} · stanza privata`
							: `${c.locationName}${c.mapName ? ` · ${c.mapName}` : ''}`
						: 'In giro per le mappe',
				href: !hidden && c.locationId ? `/gioco/luogo/${c.locationId}` : null,
				people: []
			});
		}
		groups.get(key)!.people.push(c);
	}
	return {
		me: character.id,
		total: online.length,
		groups: [...groups.values()].sort((a, b) => (a.href === null ? 1 : b.href === null ? -1 : a.title.localeCompare(b.title)))
	};
};
