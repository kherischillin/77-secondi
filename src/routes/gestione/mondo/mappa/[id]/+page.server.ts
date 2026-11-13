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
	imageFor,
	readMapForm,
	setStartMap,
	weatherOverrideSchema,
	toLocationView,
	toMapView
} from '#lib/server/world.ts';
import { deleteImage, imageSize, readImage, saveImage, UploadError } from '#lib/server/uploads.ts';
import { THEME_IDS, THEMES } from '#lib/themes.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';
import { weatherFor } from '#lib/weather.ts';
import { boundingArea, normalizeArea, normalizeShape, parseDistrictImport, wouldCycle } from '#lib/districts.ts';
import { mediaUrl } from '#lib/server/uploads.ts';
import { matchesNightCityImage, seedNightCity } from '#lib/server/seed/apply.ts';
import { NIGHT_CITY_DISTRICTS } from '#lib/server/seed/night-city.ts';

type Errors = Record<string, string>;

/** Larghezza/altezza di un'immagine caricata (per controllare che le versioni per tema combacino). */
async function imageRatio(file: string): Promise<number | null> {
	const f = await readImage(file);
	const size = f ? imageSize(f.bytes) : null;
	return size ? size.width / size.height : null;
}

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
		mapDisplay(map, event.locals.theme)
	]);
	const parentOf = new Map(maps.map((m) => [m.id, m.parentMapId]));
	return {
		map: { ...toMapView(map), sortOrder: map.sortOrder },
		// Versioni dell'immagine per ogni tema.
		themeImages: THEME_IDS.map((id) => ({ id, label: THEMES[id].label, url: mediaUrl(map.themeImages?.[id] ?? null) })),
		baseImageUrl: mediaUrl(map.image),
		display,
		districts: districts.flatMap((d) =>
			d.area ? [{ id: d.id, name: d.name, area: d.area, points: d.shape?.points, label: d.shape?.label, href: `/gestione/mondo/mappa/${d.id}` }] : []
		),
		// Mappe che possono contenere questa come distretto: con un'immagine e senza creare giri.
		parentOptions: maps
			.filter((m) => m.id !== map.id && imageFor(m) && !wouldCycle(map.id, m.id, parentOf))
			.map((m) => ({
				id: m.id,
				name: m.name,
				imageUrl: mediaUrl(imageFor(m, event.locals.theme))!,
				siblings: maps
					.filter((s) => s.parentMapId === m.id && s.id !== map.id && areaOf(s))
					.map((s) => ({ name: s.name, area: areaOf(s)!, points: normalizeShape(s.shape)?.points ?? null }))
			})),
		weather: weatherFor(map, new Date()),
		// Preparazione automatica di 77 Secondi: solo sulla mappa "Night City".
		nightCity:
			map.name.trim().toLowerCase() === 'night city'
				? {
						districts: NIGHT_CITY_DISTRICTS.length,
						locations: NIGHT_CITY_DISTRICTS.reduce((n, d) => n + d.locations.length, 0),
						imageOk: await matchesNightCityImage(map.image)
					}
				: null,
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

		// Versioni per tema: stesse proporzioni tra loro, perché distretti e luoghi sono in percentuale.
		const themeImages: Record<string, string> = { ...(map.themeImages ?? {}) };
		const replaced: string[] = [];
		for (const id of THEME_IDS) {
			try {
				const uploaded = await saveImage(form.get(`themeImage_${id}`));
				if (uploaded) {
					if (themeImages[id]) replaced.push(themeImages[id]);
					themeImages[id] = uploaded;
				}
			} catch (e) {
				if (e instanceof UploadError) return fail(400, { action: 'salva', errors: { themeImages: `${THEMES[id].label}: ${e.message}` } as Errors });
				throw e;
			}
			if (form.get(`removeThemeImage_${id}`) === 'on' && themeImages[id]) {
				replaced.push(themeImages[id]);
				delete themeImages[id];
			}
		}
		const ratios = await Promise.all(Object.values(themeImages).map(imageRatio));
		const known = ratios.filter((r): r is number => r !== null);
		if (known.some((r) => Math.abs(r - known[0]) / known[0] > 0.01)) {
			for (const f of Object.values(themeImages)) if (!Object.values(map.themeImages ?? {}).includes(f)) await deleteImage(f);
			return fail(400, { action: 'salva', errors: { themeImages: 'Le versioni per tema devono avere tutte le stesse proporzioni (stessa larghezza e altezza).' } as Errors });
		}

		await db.update(schema.maps).set({ ...parsed.data, image, themeImages }).where(eq(schema.maps.id, map.id));
		if (image !== map.image) await deleteImage(map.image);
		for (const f of replaced) await deleteImage(f);
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
			await db.update(schema.maps).set({ parentMapId: null, areaX: null, areaY: null, areaW: null, areaH: null, shape: null }).where(eq(schema.maps.id, map.id));
			await audit({ actorUserId: user.id, action: 'map.district', targetType: 'map', targetId: map.id, details: { mappa: map.name, distretto: 'nessuno' }, ip: clientIp(event) });
			return { action: 'distretto', success: 'Questa mappa non è più un distretto.' };
		}
		const parent = await getMap(Number(rawParent));
		const maps = await listMaps();
		if (!parent || !imageFor(parent) || wouldCycle(map.id, parent.id, new Map(maps.map((m) => [m.id, m.parentMapId])))) {
			return fail(400, { action: 'distretto', errors: { parentMapId: 'Scegli una mappa con un\'immagine (e non un distretto di questa).' } as Errors });
		}
		// Forma libera (se disegnata) oppure rettangolo.
		let shape = null;
		const rawShape = String(form.get('shape') ?? '');
		if (rawShape) {
			try {
				shape = normalizeShape(JSON.parse(rawShape));
			} catch {
				shape = null;
			}
			if (!shape) return fail(400, { action: 'distretto', errors: { area: 'La forma non è valida: ridisegnala.' } as Errors });
		}
		const area = shape ? boundingArea(shape.points) : normalizeArea({ x: form.get('areaX'), y: form.get('areaY'), w: form.get('areaW'), h: form.get('areaH') });
		if (!area) return fail(400, { action: 'distretto', errors: { area: 'Disegna la zona del distretto sull\'immagine.' } as Errors });
		await db
			.update(schema.maps)
			.set({ parentMapId: parent.id, areaX: area.x, areaY: area.y, areaW: area.w, areaH: area.h, shape })
			.where(eq(schema.maps.id, map.id));
		await audit({ actorUserId: user.id, action: 'map.district', targetType: 'map', targetId: map.id, details: { mappa: map.name, dentro: parent.name, area }, ip: clientIp(event) });
		return { action: 'distretto', success: `Distretto di ${parent.name} salvato.` };
	},

	/** Molti distretti insieme: elenco JSON con nome e forma. Stesso nome = aggiorna la mappa esistente. */
	importaDistretti: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const map = await loadMapOr404(event.params.id);
		if (!map.image) return fail(400, { action: 'importaDistretti', errors: { json: 'Prima carica l\'immagine di questa mappa.' } as Errors });
		const { districts, errors } = parseDistrictImport(String((await event.request.formData()).get('json') ?? ''));
		if (!districts.length) return fail(400, { action: 'importaDistretti', errors: { json: errors.join(' ') || 'Nessun distretto da importare.' } as Errors });

		const maps = await listMaps();
		const parentOf = new Map(maps.map((m) => [m.id, m.parentMapId]));
		let created = 0;
		let updated = 0;
		const skipped: string[] = [...errors];
		await db.transaction(async (tx) => {
			for (const d of districts) {
				const area = boundingArea(d.shape.points);
				const values = { parentMapId: map.id, areaX: area.x, areaY: area.y, areaW: area.w, areaH: area.h, shape: d.shape };
				const existing = maps.find((m) => m.name.toLowerCase() === d.name.toLowerCase());
				if (existing) {
					if (existing.id === map.id || wouldCycle(existing.id, map.id, parentOf)) {
						skipped.push(`${d.name}: non può essere un distretto di questa mappa.`);
						continue;
					}
					await tx
						.update(schema.maps)
						.set({ ...values, ...(d.description && !existing.description ? { description: d.description } : {}) })
						.where(eq(schema.maps.id, existing.id));
					updated++;
				} else {
					await tx.insert(schema.maps).values({ name: d.name, description: d.description, climate: map.climate, ...values });
					created++;
				}
			}
		});
		await audit({ actorUserId: user.id, action: 'map.district', targetType: 'map', targetId: map.id, details: { mappa: map.name, importati: created, aggiornati: updated }, ip: clientIp(event) });
		return {
			action: 'importaDistretti',
			success: `Distretti importati: ${created} nuovi, ${updated} aggiornati.${skipped.length ? ' Saltati: ' + skipped.join(' ') : ''}`
		};
	},

	/** 77 Secondi: crea i distretti di Night City con le loro forme e i luoghi della legenda. */
	preparaNightCity: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const map = await loadMapOr404(event.params.id);
		if (map.name.trim().toLowerCase() !== 'night city') error(404, 'Non disponibile per questa mappa.');
		if (!(await matchesNightCityImage(map.image))) {
			return fail(400, { action: 'preparaNightCity', errors: { nightCity: 'Prima carica come immagine di questa mappa il file night-city.webp (le forme dei distretti sono calcolate su quello).' } as Errors });
		}
		const r = await seedNightCity(map.id);
		await audit({ actorUserId: user.id, action: 'world.seed', targetType: 'map', targetId: map.id, details: { mappa: map.name, ...r }, ip: clientIp(event) });
		return {
			action: 'preparaNightCity',
			success: `Night City pronta: ${r.created} distretti nuovi, ${r.updated} aggiornati, ${r.locations} luoghi aggiunti, ${r.descriptions} descrizioni aggiornate.${r.skipped.length ? ' Saltati: ' + r.skipped.join(', ') + '.' : ''}`
		};
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
		for (const f of Object.values(map.themeImages ?? {})) await deleteImage(f);
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
