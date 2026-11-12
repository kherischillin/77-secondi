import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import {
	getLocation,
	getMap,
	listLocations,
	listMaps,
	readLocationForm,
	toLocationView,
	toMapView,
	mapDisplay
} from '#lib/server/world.ts';
import { deleteImage, saveImage, UploadError } from '#lib/server/uploads.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';
import { broadcastLocationChanged } from '#lib/server/realtime.ts';

type Errors = Record<string, string>;

async function loadOr404(id: string) {
	const location = await getLocation(Number(id));
	if (!location) error(404, 'Luogo non trovato.');
	const map = await getMap(location.mapId);
	if (!map) error(404, 'Mappa non trovata.');
	return { location, map };
}

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'world.manage');
	const { location, map } = await loadOr404(event.params.id);
	const [siblings, maps, display] = await Promise.all([
		listLocations(map.id, { includeInactive: true }),
		listMaps(),
		mapDisplay(map)
	]);
	return {
		location: { ...toLocationView(location), sortOrder: location.sortOrder },
		// Nei distretti senza immagine propria si posiziona sul pezzo ingrandito della mappa madre.
		map: { ...toMapView(map), imageUrl: display.imageUrl },
		crop: display.crop,
		siblings: siblings
			.filter((l) => l.id !== location.id)
			.map((l) => ({ id: l.id, name: l.name, x: l.x, y: l.y, kind: l.kind })),
		maps: maps.filter((m) => m.id !== map.id).map((m) => ({ id: m.id, name: m.name })),
		isNew: event.url.searchParams.has('nuovo')
	};
};

export const actions: Actions = {
	salva: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const { location, map } = await loadOr404(event.params.id);
		const form = await event.request.formData();
		const parsed = readLocationForm(form);
		if (!parsed.success) return fail(400, { action: 'salva', errors: fieldErrors(parsed.error) });

		const data = parsed.data;
		if (data.kind === 'map_link') {
			const target = await getMap(data.linkedMapId!);
			if (!target || target.id === map.id) {
				return fail(400, { action: 'salva', errors: { linkedMapId: 'Scegli un’altra mappa esistente.' } as Errors });
			}
		} else {
			data.linkedMapId = null;
		}

		let image = location.image;
		try {
			const uploaded = await saveImage(form.get('image'));
			if (uploaded) image = uploaded;
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { action: 'salva', errors: { image: e.message } as Errors });
			throw e;
		}
		if (form.get('removeImage') === 'on') image = null;

		await db.update(schema.locations).set({ ...data, image }).where(eq(schema.locations.id, location.id));
		if (image !== location.image) await deleteImage(location.image);
		// Chi è nella chat vede subito la nuova descrizione.
		broadcastLocationChanged(location.id);

		await audit({
			actorUserId: user.id,
			action: 'location.update',
			targetType: 'location',
			targetId: location.id,
			details: { nome: data.name },
			ip: clientIp(event)
		});
		return { action: 'salva', success: 'Luogo salvato.' };
	},

	elimina: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const { location, map } = await loadOr404(event.params.id);
		await db.delete(schema.locations).where(eq(schema.locations.id, location.id));
		await deleteImage(location.image);
		broadcastLocationChanged(location.id);
		await audit({
			actorUserId: user.id,
			action: 'location.delete',
			targetType: 'location',
			targetId: location.id,
			details: { nome: location.name, mappa: map.name },
			ip: clientIp(event)
		});
		redirect(303, `/gestione/mondo/mappa/${map.id}`);
	}
};
