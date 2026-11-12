import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { getLocation, getMap, listDistricts, listLocations, mapDisplay, toLocationView, toMapView } from '#lib/server/world.ts';
import { enterMap, getPresence, listOnline } from '#lib/server/presence.ts';
import { broadcastPresence } from '#lib/server/realtime.ts';
import { bookedLocationIds } from '#lib/server/rooms.ts';
import { weatherFor } from '#lib/weather.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const map = await getMap(Number(event.params.id));
	if (!map) error(404, 'Mappa non trovata.');

	// Tornando alla mappa si esce dal luogo in cui si era: gli altri lo vedono subito.
	const before = await getPresence(character.id);
	await enterMap(character.id, map.id);
	if (before?.locationId) void broadcastPresence(before.locationId);

	const [locations, online, districts, display] = await Promise.all([listLocations(map.id), listOnline(), listDistricts(map.id), mapDisplay(map)]);
	const people = new Map<number, { id: number; name: string; avatarUrl: string | null }[]>();
	for (const c of online) {
		if (!c.locationId || c.locationPrivate) continue;
		const list = people.get(c.locationId) ?? [];
		list.push({ id: c.characterId, name: c.name, avatarUrl: c.avatarUrl });
		people.set(c.locationId, list);
	}
	const booked = await bookedLocationIds(locations.filter((l) => l.isPrivate).map((l) => l.id));
	// Rimandati qui da una stanza privata prenotata da altri (vedi gioco/luogo/[id]).
	const blockedId = Number(event.url.searchParams.get('stanza-occupata'));
	const blocked = Number.isInteger(blockedId) && blockedId > 0 ? await getLocation(blockedId) : null;
	return {
		roomWarning: blocked?.isPrivate ? `La stanza privata «${blocked.name}» è prenotata da un altro personaggio: si entra solo su invito di chi l'ha prenotata.` : null,
		map: { ...toMapView(map), imageUrl: display.imageUrl },
		crop: display.crop,
		parent: display.parent,
		// Distretti: aree cliccabili, con quanti personaggi ci sono dentro (fuori dalle stanze private).
		districts: districts.map((d) => ({
			...d,
			present: online.filter((c) => c.mapId === d.id && !c.locationPrivate).length
		})),
		weather: weatherFor(map, new Date()),
		locations: locations.map((l) => ({
			...toLocationView(l),
			// Nelle stanze private non si mostra quante persone ci sono: solo se sono occupate.
			present: l.isPrivate ? 0 : (people.get(l.id)?.length ?? 0),
			// Chi c'è, con l'avatar (al massimo 8, poi "+N").
			people: l.isPrivate ? [] : (people.get(l.id) ?? []).slice(0, 8),
			booked: booked.has(l.id)
		}))
	};
};
