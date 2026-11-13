import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from './db/index.ts';
import { mediaUrl, storedImageSize } from './uploads.ts';
import { CLIMATES } from '../weather.ts';
import { normalizeShape, type Area, type Point, type Shape } from '../districts.ts';

export type MapView = {
	id: number;
	name: string;
	description: string;
	imageUrl: string | null;
	isStart: boolean;
	climate: string | null;
	weatherOverride: string | null;
	weatherOverrideUntil: string | null;
	/** Distretto: mappa madre e area occupata sulla sua immagine. */
	parentMapId: number | null;
	area: Area | null;
	/** Forma libera del distretto (se c'è). */
	shape: Shape | null;
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
	isPrivate: boolean;
	hourlyPrice: number;
	maxHours: number;
};

export function toMapView(m: typeof schema.maps.$inferSelect): MapView {
	return {
		id: m.id,
		name: m.name,
		description: m.description,
		imageUrl: mediaUrl(imageFor(m)),
		isStart: m.isStart,
		climate: m.climate,
		weatherOverride: m.weatherOverride,
		weatherOverrideUntil: m.weatherOverrideUntil?.toISOString() ?? null,
		parentMapId: m.parentMapId,
		area: areaOf(m),
		shape: normalizeShape(m.shape)
	};
}

type MapRow = typeof schema.maps.$inferSelect;

/**
 * File dell'immagine di una mappa per un tema: la versione di quel tema se c'è,
 * altrimenti l'immagine normale, altrimenti una qualsiasi delle versioni per tema.
 * Le versioni devono avere le stesse proporzioni, perché distretti e luoghi sono in percentuale.
 */
export function imageFor(m: Pick<MapRow, 'image' | 'themeImages'>, theme?: string | null): string | null {
	const versions = m.themeImages ?? {};
	return (theme ? versions[theme] : undefined) ?? m.image ?? Object.values(versions)[0] ?? null;
}

export function areaOf(m: MapRow): Area | null {
	return m.areaX !== null && m.areaY !== null && m.areaW !== null && m.areaH !== null
		? { x: m.areaX, y: m.areaY, w: m.areaW, h: m.areaH }
		: null;
}

/**
 * Immagine da mostrare per una mappa: la sua, oppure (per un distretto senza immagine)
 * quella della mappa madre ritagliata sull'area del distretto.
 */
export type MapDisplay = {
	imageUrl: string | null;
	/** Misure dell'immagine intera (anche quando se ne mostra solo un ritaglio). */
	size: { width: number; height: number } | null;
	crop: Area | null;
	/** Forma del distretto sull'immagine della madre, per scurire ciò che c'è intorno. */
	focus: Point[] | null;
	parent: { id: number; name: string } | null;
};

export async function mapDisplay(m: MapRow, theme?: string | null): Promise<MapDisplay> {
	const parent = m.parentMapId ? await getMap(m.parentMapId) : null;
	const parentInfo = parent ? { id: parent.id, name: parent.name } : null;
	const own = imageFor(m, theme);
	if (own) return { imageUrl: mediaUrl(own), size: await storedImageSize(own), crop: null, focus: null, parent: parentInfo };
	const area = areaOf(m);
	const parentImage = parent ? imageFor(parent, theme) : null;
	if (parentImage && area) {
		return { imageUrl: mediaUrl(parentImage), size: await storedImageSize(parentImage), crop: area, focus: normalizeShape(m.shape)?.points ?? null, parent: parentInfo };
	}
	return { imageUrl: null, size: null, crop: null, focus: null, parent: parentInfo };
}

/** Distretti di una mappa (le sue mappe figlie con un'area), in ordine. */
export async function listDistricts(mapId: number) {
	const rows = await db
		.select()
		.from(schema.maps)
		.where(eq(schema.maps.parentMapId, mapId))
		.orderBy(asc(schema.maps.sortOrder), asc(schema.maps.name));
	return rows.map((m) => ({ id: m.id, name: m.name, description: m.description, area: areaOf(m), shape: normalizeShape(m.shape) }));
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
		isActive: l.isActive,
		isPrivate: l.isPrivate,
		hourlyPrice: l.hourlyPrice,
		maxHours: l.maxHours
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

/**
 * La mappa principale (di partenza): quella marcata «partenza»; in mancanza, la prima mappa
 * "madre" con un'immagine (es. Night City). I distretti (mappe figlie) e le mappe senza immagine,
 * come quella che raccoglie le stanze private, vengono solo per ultimi.
 */
export async function getStartMap() {
	const [start] = await db
		.select()
		.from(schema.maps)
		.orderBy(
			sql`(${schema.maps.isStart} and ${schema.maps.parentMapId} is null) desc`,
			sql`(${schema.maps.parentMapId} is null) desc`,
			sql`(${schema.maps.image} is not null or ${schema.maps.themeImages} <> '{}'::jsonb) desc`,
			sql`${schema.maps.isStart} desc`,
			asc(schema.maps.sortOrder),
			asc(schema.maps.id)
		)
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
	sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
	climate: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.enum(CLIMATES).nullable())
});

/** Meteo deciso dallo staff: testo e durata in ore (0 = torna automatico). */
export const weatherOverrideSchema = z.object({
	text: z.string().trim().max(80, 'Testo troppo lungo.'),
	hours: z.coerce.number().int().min(0).max(24 * 7)
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
		sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
		isPrivate: z.boolean(),
		hourlyPrice: z.coerce.number().int('Solo numeri interi.').min(0, 'Il prezzo non può essere negativo.').max(1_000_000),
		maxHours: z.coerce.number().int('Solo numeri interi.').min(1, 'Almeno 1 ora.').max(48, 'Al massimo 48 ore.')
	})
	.refine((d) => d.kind !== 'map_link' || d.linkedMapId !== null, {
		message: 'Scegli la mappa verso cui porta il collegamento.',
		path: ['linkedMapId']
	});

export function readMapForm(form: FormData) {
	return mapFormSchema.safeParse({
		name: String(form.get('name') ?? ''),
		description: String(form.get('description') ?? ''),
		sortOrder: form.get('sortOrder') || 0,
		climate: form.get('climate')
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
		sortOrder: form.get('sortOrder') || 0,
		isPrivate: form.get('isPrivate') === 'on',
		hourlyPrice: form.get('hourlyPrice') || 0,
		maxHours: form.get('maxHours') || 4
	});
}
