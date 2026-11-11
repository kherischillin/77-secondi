import { fail, redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { readMapForm, setStartMap, toMapView } from '#lib/server/world.ts';
import { saveImage, UploadError } from '#lib/server/uploads.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'world.manage');
	const rows = await db
		.select({
			map: schema.maps,
			locations: sql<number>`(select count(*)::int from ${schema.locations} l where l.map_id = ${schema.maps.id})`
		})
		.from(schema.maps)
		.orderBy(schema.maps.sortOrder, schema.maps.name);
	return { maps: rows.map((r) => ({ ...toMapView(r.map), locations: r.locations })) };
};

export const actions: Actions = {
	crea: async (event) => {
		const { user } = requireCapability(event, 'world.manage');
		const form = await event.request.formData();
		const parsed = readMapForm(form);
		const values = { name: String(form.get('name') ?? ''), description: String(form.get('description') ?? '') };
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });

		let image: string | null;
		try {
			image = await saveImage(form.get('image'));
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { errors: { image: e.message } as Record<string, string>, values });
			throw e;
		}

		const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.maps);
		const [map] = await db.insert(schema.maps).values({ ...parsed.data, image }).returning();
		// La prima mappa creata diventa automaticamente quella di partenza.
		if (total === 0 || form.get('isStart') === 'on') await setStartMap(map.id);

		await audit({
			actorUserId: user.id,
			action: 'map.create',
			targetType: 'map',
			targetId: map.id,
			details: { nome: map.name },
			ip: clientIp(event)
		});
		redirect(303, `/gestione/mondo/mappa/${map.id}`);
	}
};
