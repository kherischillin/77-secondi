import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import {
	getMap,
	listLocations,
	listMaps,
	readMapForm,
	setStartMap,
	toLocationView,
	toMapView
} from '#lib/server/world.ts';
import { deleteImage, saveImage, UploadError } from '#lib/server/uploads.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

type Errors = Record<string, string>;

async function loadMapOr404(id: string) {
	const map = await getMap(Number(id));
	if (!map) error(404, 'Mappa non trovata.');
	return map;
}

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'world.manage');
	const map = await loadMapOr404(event.params.id);
	const [locations, maps] = await Promise.all([
		listLocations(map.id, { includeInactive: true }),
		listMaps()
	]);
	return {
		map: { ...toMapView(map), sortOrder: map.sortOrder },
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
