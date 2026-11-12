import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { getMap, listLocations, toLocationView, toMapView } from '#lib/server/world.ts';
import { countByLocation, enterMap, getPresence } from '#lib/server/presence.ts';
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

	const [locations, counts] = await Promise.all([listLocations(map.id), countByLocation()]);
	const booked = await bookedLocationIds(locations.filter((l) => l.isPrivate).map((l) => l.id));
	return {
		map: toMapView(map),
		weather: weatherFor(map, new Date()),
		locations: locations.map((l) => ({
			...toLocationView(l),
			// Nelle stanze private non si mostra quante persone ci sono: solo se sono occupate.
			present: l.isPrivate ? 0 : (counts.get(l.id) ?? 0),
			booked: booked.has(l.id)
		}))
	};
};
