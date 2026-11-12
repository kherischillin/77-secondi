import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import {
	getMap,
	listDistricts,
	listLocations,
	listMaps,
	mapDisplay,
	areaOf,
	readMapForm,
	setStartMap,
	weatherOverrideSchema,
	toLocationView,
	toMapView
} from '#lib/server/world.ts';
import { deleteImage, saveImage, UploadError } from '#lib/server/uploads.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';
import { weatherFor } from '#lib/weather.ts';
import { normalizeArea, wouldCycle } from '#lib/districts.ts';
import { mediaUrl } from '#lib/server/uploads.ts';

type Errors = Record<string, string>;

async function loadMapOr404(id: string) {
	const map = await getMap(Number(id));
	if (!map) error(404, 'Mappa non trovata.');
	return map;
}

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'world.manage');
	const map = await loadMapOr404(event.params.id);
	const [locations, maps, districts, display] = await Promise.all([
		listLocations(map.id, { includeInactive: true }),
		listMaps(),
		listDistricts(map.id),
		mapDisplay(map)
	]);
	const parentOf = new Map(maps.map((m) => [m.id, m.parentMapId]));
	return {
		map: { ...toMapView(map), sortOrder: map.sortOrder },
		display,
		districts: districts.flatMap((d) => (d.area ? [{ id: d.id, name: d.name, area: d.area, href: `/gestione/mondo/mappa/${d.id}` }] : [])),
		// Mappe che possono contenere questa come distretto: con un'immagine e senza creare giri.
		parentOptions: maps
			.filter((m) => m.id !== map.id && m.image && !wouldCycle(map.id, m.id, parentOf))
			.map((m) => ({
				id: m.id,
				name: m.name,
				imageUrl: mediaUrl(m.image)!,
				siblings: maps.filter((s) => s.parentMapId === m.id && s.id !== map.id && areaOf(s)).map((s) => ({ name: s.name, area: areaOf(s)! }))
			})),
		weather: weatherFor(map, new Date()),
		locations: locations.map(toLocationView),
		otherMaps: maps.filter((m) => m.id !== map.id).map((m) => ({ id: m.id, name: m.name }))
	};
};

export const actions: Actions = {
	salva: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const map = await loadMapOr404(event.params.id);
		const form = await event.request.formData();
		const parsed = readMapForm(form);
		if (!parsed.success) return fail(400, { action: 'salva', errors: fieldErrors(parsed.error) });

		let image = map.image;
		try {
			const uploaded = await saveImage(form.get('image'));
			if (uploaded) image = uploaded;
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { action: 'salva', errors: { image: e.message } as Errors });
			throw e;
		}
		if (form.get('removeImage') === 'on') image = null;

		await db.update(schema.maps).set({ ...parsed.data, image }).where(eq(schema.maps.id, map.id));
		if (image !== map.image) await deleteImage(map.image);
		if (form.get('isStart') === 'on' && !map.isStart) await setStartMap(map.id);

		await audit({
			actorUserId: user.id,
			action: 'map.update',
			targetType: 'map',
			targetId: map.id,
			details: { nome: parsed.data.name },
			ip: clientIp(event)
		});
		return { action: 'salva', success: 'Mappa salvata.' };
	},

	/** Distretto: di quale mappa fa parte e quale area occupa sulla sua immagine. */
	distretto: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const map = await loadMapOr404(event.params.id);
		const form = await event.request.formData();
		const rawParent = String(form.get('parentMapId') ?? '');
		if (rawParent === '') {
			await db.update(schema.maps).set({ parentMapId: null, areaX: null, areaY: null, areaW: null, areaH: null }).where(eq(schema.maps.id, map.id));
			await audit({ actorUserId: user.id, action: 'map.district', targetType: 'map', targetId: map.id, details: { mappa: map.name, distretto: 'nessuno' }, ip: clientIp(event) });
			return { action: 'distretto', success: 'Questa mappa non è più un distretto.' };
		}
		const parent = await getMap(Number(rawParent));
		const maps = await listMaps();
		if (!parent || !parent.image || wouldCycle(map.id, parent.id, new Map(maps.map((m) => [m.id, m.parentMapId])))) {
			return fail(400, { action: 'distretto', errors: { parentMapId: 'Scegli una mappa con un\'immagine (e non un distretto di questa).' } as Errors });
		}
		const area = normalizeArea({ x: form.get('areaX'), y: form.get('areaY'), w: form.get('areaW'), h: form.get('areaH') });
		if (!area) return fail(400, { action: 'distretto', errors: { area: 'Disegna l\'area del distretto trascinando sull\'immagine.' } as Errors });
		await db
			.update(schema.maps)
			.set({ parentMapId: parent.id, areaX: area.x, areaY: area.y, areaW: area.w, areaH: area.h })
			.where(eq(schema.maps.id, map.id));
		await audit({ actorUserId: user.id, action: 'map.district', targetType: 'map', targetId: map.id, details: { mappa: map.name, dentro: parent.name, area }, ip: clientIp(event) });
		return { action: 'distretto', success: `Distretto di ${parent.name} salvato.` };
	},

	/** Meteo deciso dallo staff per qualche ora (0 ore = torna automatico). */
	meteo: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const map = await loadMapOr404(event.params.id);
		const form = await event.request.formData();
		const parsed = weatherOverrideSchema.safeParse({ text: String(form.get('text') ?? ''), hours: form.get('hours') ?? 0 });
		if (!parsed.success) return fail(400, { action: 'meteo', errors: fieldErrors(parsed.error) });
		const { text, hours } = parsed.data;
		const reset = form.get('reset') === '1' || hours === 0;
		if (!reset && !text) return fail(400, { action: 'meteo', errors: { text: 'Scrivi che tempo fa.' } as Errors });
		await db
			.update(schema.maps)
			.set(reset ? { weatherOverride: null, weatherOverrideUntil: null } : { weatherOverride: text, weatherOverrideUntil: new Date(Date.now() + hours * 3_600_000) })
			.where(eq(schema.maps.id, map.id));
		await audit({ actorUserId: user.id, action: 'map.weather', targetType: 'map', targetId: map.id, details: reset ? { mappa: map.name, meteo: 'automatico' } : { mappa: map.name, meteo: text, ore: hours }, ip: clientIp(event) });
		return { action: 'meteo', success: reset ? 'Torna il meteo automatico.' : 'Meteo impostato.' };
	},

	nuovoLuogo: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const map = await loadMapOr404(event.params.id);
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (name.length < 2 || name.length > 60) {
			return fail(400, { action: 'nuovoLuogo', errors: { locationName: 'Il nome deve avere tra 2 e 60 caratteri.' } as Errors });
		}
		const [location] = await db.insert(schema.locations).values({ mapId: map.id, name }).returning();
		await audit({
			actorUserId: user.id,
			action: 'location.create',
			targetType: 'location',
			targetId: location.id,
			details: { nome: name, mappa: map.name },
			ip: clientIp(event)
		});
		redirect(303, `/gestione/mondo/luogo/${location.id}?nuovo=1`);
	},

	elimina: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const map = await loadMapOr404(event.params.id);
		const form = await event.request.formData();
		if (String(form.get('confirm') ?? '').trim().toLowerCase() !== map.name.toLowerCase()) {
			return fail(400, { action: 'elimina', errors: { confirm: 'Scrivi esattamente il nome della mappa per confermare.' } as Errors });
		}
		const locations = await listLocations(map.id, { includeInactive: true });
		await db.delete(schema.maps).where(eq(schema.maps.id, map.id));
		await deleteImage(map.image);
		for (const l of locations) await deleteImage(l.image);
		await audit({
			actorUserId: user.id,
			action: 'map.delete',
			targetType: 'map',
			targetId: map.id,
			details: { nome: map.name, luoghiEliminati: locations.length },
			ip: clientIp(event)
		});
		redirect(303, '/gestione/mondo');
	}
};
