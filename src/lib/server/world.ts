import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from './db/index.ts';
import { mediaUrl } from './uploads.ts';

export type MapView = {
	id: number;
	name: string;
	description: string;
	imageUrl: string | null;
	isStart: boolean;
};

export type LocationView = {
	id: number;
	mapId: number;
	name: string;
	description: string;
	imageUrl: string | null;
	kind: 'chat' | 'map_link';
	linkedMapId: number | null;
	x: number | null;
	y: number | null;
	isActive: boolean;
};

export function toMapView(m: typeof schema.maps.$inferSelect): MapView {
	return {
		id: m.id,
		name: m.name,
		description: m.description,
		imageUrl: mediaUrl(m.image),
		isStart: m.isStart
	};
}

export function toLocationView(l: typeof schema.locations.$inferSelect): LocationView {
	return {
		id: l.id,
		mapId: l.mapId,
		name: l.name,
		description: l.description,
		imageUrl: mediaUrl(l.image),
		kind: l.kind,
		linkedMapId: l.linkedMapId,
		x: l.x,
		y: l.y,
		isActive: l.isActive
	};
}

export async function listMaps() {
	return db.select().from(schema.maps).orderBy(asc(schema.maps.sortOrder), asc(schema.maps.name));
}

export async function getMap(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [m] = await db.select().from(schema.maps).where(eq(schema.maps.id, id));
	return m ?? null;
}

/** La mappa di partenza; se nessuna è marcata, la prima in ordine. */
export async function getStartMap() {
	const [start] = await db
		.select()
		.from(schema.maps)
		.orderBy(sql`${schema.maps.isStart} desc`, asc(schema.maps.sortOrder), asc(schema.maps.id))
		.limit(1);
	return start ?? null;
}

export async function listLocations(mapId: number, opts: { includeInactive?: boolean } = {}) {
	return db
		.select()
		.from(schema.locations)
		.where(
			opts.includeInactive
				? eq(schema.locations.mapId, mapId)
				: and(eq(schema.locations.mapId, mapId), eq(schema.locations.isActive, true))
		)
		.orderBy(asc(schema.locations.sortOrder), asc(schema.locations.name));
}

export async function getLocation(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [l] = await db.select().from(schema.locations).where(eq(schema.locations.id, id));
	return l ?? null;
}

/** Imposta una sola mappa come mappa di partenza. */
export async function setStartMap(mapId: number) {
	await db.transaction(async (tx) => {
		await tx.update(schema.maps).set({ isStart: false });
		await tx.update(schema.maps).set({ isStart: true }).where(eq(schema.maps.id, mapId));
	});
}

// ---------------------------------------------------------------------------
// Validazione dei form del pannello
// ---------------------------------------------------------------------------

const position = z.preprocess(
	(v) => (v === '' || v === null || v === undefined ? null : Number(v)),
	z.number().min(0).max(100).nullable()
);

export const mapFormSchema = z.object({
	name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(60, 'Nome troppo lungo.'),
	description: z.string().trim().max(5000, 'Descrizione troppo lunga.'),
	sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0)
});

export const locationFormSchema = z
	.object({
		name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(60, 'Nome troppo lungo.'),
		description: z.string().trim().max(5000, 'Descrizione troppo lunga.'),
		kind: z.enum(['chat', 'map_link']),
		linkedMapId: z.preprocess(
			(v) => (v === '' || v === null || v === undefined ? null : Number(v)),
			z.number().int().positive().nullable()
		),
		x: position,
		y: position,
		isActive: z.boolean(),
		sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0)
	})
	.refine((d) => d.kind !== 'map_link' || d.linkedMapId !== null, {
		message: 'Scegli la mappa verso cui porta il collegamento.',
		path: ['linkedMapId']
	});

export function readMapForm(form: FormData) {
	return mapFormSchema.safeParse({
		name: String(form.get('name') ?? ''),
		description: String(form.get('description') ?? ''),
		sortOrder: form.get('sortOrder') || 0
	});
}

export function readLocationForm(form: FormData) {
	return locationFormSchema.safeParse({
		name: String(form.get('name') ?? ''),
		description: String(form.get('description') ?? ''),
		kind: String(form.get('kind') ?? 'chat'),
		linkedMapId: form.get('linkedMapId'),
		x: form.get('x'),
		y: form.get('y'),
		isActive: form.get('isActive') === 'on',
		sortOrder: form.get('sortOrder') || 0
	});
}
