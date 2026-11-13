import { error, fail } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { clientIp, requireCapability, requireCharacter } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { audit } from '#lib/server/audit.ts';
import { readPositions } from '#lib/districts.ts';
import { getLocation, getMap, mapWeather, listDistricts, listLocations, mapDisplay, toLocationView, toMapView } from '#lib/server/world.ts';
import { enterMap, getPresence, listOnline } from '#lib/server/presence.ts';
import { broadcastPresence } from '#lib/server/realtime.ts';
import { bookedLocationIds } from '#lib/server/rooms.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const map = await getMap(Number(event.params.id));
	if (!map) error(404, 'Mappa non trovata.');

	// Tornando alla mappa si esce dal luogo in cui si era: gli altri lo vedono subito.
	const before = await getPresence(character.id);
	await enterMap(character.id, map.id);
	if (before?.locationId) void broadcastPresence(before.locationId);

	const [locations, online, districts, display] = await Promise.all([listLocations(map.id), listOnline(), listDistricts(map.id), mapDisplay(map, event.locals.theme)]);
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
		// Chi gestisce il mondo può spostare i luoghi trascinandoli sulla mappa.
		canMove: event.locals.user?.capabilities.has('world.manage') ?? false,
		roomWarning: blocked?.isPrivate ? `La stanza privata «${blocked.name}» è prenotata da un altro personaggio: si entra solo su invito di chi l'ha prenotata.` : null,
		map: { ...toMapView(map), imageUrl: display.imageUrl },
		crop: display.crop,
		focus: display.focus,
		size: display.size,
		parent: display.parent,
		// Distretti: aree cliccabili, con quanti personaggi ci sono dentro (fuori dalle stanze private).
		districts: districts.map((d) => ({
			...d,
			present: online.filter((c) => c.mapId === d.id && !c.locationPrivate).length
		})),
		weather: (await mapWeather(map)).weather,
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

export const actions: Actions = {
	/** Nuove posizioni dei luoghi di questa mappa, spostati trascinandoli (solo staff con world.manage). */
	posizioni: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const map = await getMap(Number(event.params.id));
		if (!map) error(404, 'Mappa non trovata.');
		const positions = readPositions((await event.request.formData()).get('positions'));
		if (!positions) return fail(400, { error: 'Posizioni non valide.' });
		if (positions.length === 0) return { success: 'Nessun luogo spostato.' };
		const ids = positions.map((p) => p.id);
		const own = await db
			.select({ id: schema.locations.id, name: schema.locations.name })
			.from(schema.locations)
			.where(and(eq(schema.locations.mapId, map.id), inArray(schema.locations.id, ids)));
		if (own.length !== ids.length) return fail(400, { error: 'Alcuni luoghi non appartengono a questa mappa.' });
		await db.transaction(async (tx) => {
			for (const p of positions) await tx.update(schema.locations).set({ x: p.x, y: p.y }).where(eq(schema.locations.id, p.id));
		});
		await audit({
			actorUserId: user.id,
			action: 'location.move',
			targetType: 'map',
			targetId: map.id,
			details: { mappa: map.name, luoghi: own.map((l) => l.name).join(', ') },
			ip: clientIp(event)
		});
		return { success: positions.length === 1 ? 'Posizione salvata.' : `Posizioni salvate (${positions.length} luoghi).` };
	}
};
