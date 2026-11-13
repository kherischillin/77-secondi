import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';
import { deleteImage, imageSize, readImage } from '../uploads.ts';
import { boundingArea, spreadPoints, wouldCycle } from '../../districts.ts';
import { NIGHT_CITY_DISTRICTS, NIGHT_CITY_DISTRICTS as RED_DISTRICTS, NIGHT_CITY_IMAGE, type SeedDistrict } from './night-city.ts';
import { NIGHT_CITY_2077, NIGHT_CITY_2077_IMAGE, RED_TO_2077 } from './night-city-2077.ts';

export class SeedError extends Error {}

export type SeedResult = { created: number; updated: number; locations: number; descriptions: number; skipped: string[] };

/** Una descrizione si può sostituire se è vuota o è ancora quella messa da una versione precedente dei dati. */
const replaceable = (current: string, previous?: string) => current.trim() === '' || (!!previous && current.trim() === previous);

/** Vero se l'immagine caricata ha le stesse proporzioni di quella su cui sono state calcolate le forme. */
export async function matchesNightCityImage(image: string | null): Promise<boolean> {
	if (!image) return false;
	const file = await readImage(image);
	const size = file ? imageSize(file.bytes) : null;
	if (!size) return false;
	const expected = NIGHT_CITY_IMAGE.width / NIGHT_CITY_IMAGE.height;
	return Math.abs(size.width / size.height - expected) / expected < 0.01;
}

/**
 * Crea (o aggiorna) i distretti di una mappa e i loro luoghi.
 * - Un distretto con lo stesso nome (o un nome alternativo) di una mappa esistente la aggiorna: madre, area e forma.
 *   Nome, immagine e descrizione già scritta restano quelli dello staff.
 * - I luoghi si aggiungono solo se nel distretto non ce n'è già uno con lo stesso nome: si può rilanciare senza doppioni.
 */
export async function applyDistricts(parentId: number, districts: SeedDistrict[]): Promise<SeedResult> {
	return db.transaction(async (tx) => {
		const [parent] = await tx.select().from(schema.maps).where(eq(schema.maps.id, parentId)).for('update');
		if (!parent) throw new SeedError('Mappa non trovata.');
		const maps = await tx.select().from(schema.maps);
		const parentOf = new Map(maps.map((m) => [m.id, m.parentMapId]));
		const result: SeedResult = { created: 0, updated: 0, locations: 0, descriptions: 0, skipped: [] };

		for (const d of districts) {
			const names = [d.name, ...(d.aliases ?? [])].map((n) => n.toLowerCase());
			const existing = maps.find((m) => m.id !== parent.id && names.includes(m.name.toLowerCase()));
			const values = { parentMapId: parent.id, areaX: d.area.x, areaY: d.area.y, areaW: d.area.w, areaH: d.area.h, shape: d.shape };
			let districtId: number;
			if (existing) {
				if (wouldCycle(existing.id, parent.id, parentOf)) {
					result.skipped.push(d.name);
					continue;
				}
				const newDescription = replaceable(existing.description, d.previous) && existing.description !== d.description;
				if (newDescription) result.descriptions++;
				await tx
					.update(schema.maps)
					.set({ ...values, ...(newDescription ? { description: d.description } : {}), ...(existing.climate ? {} : { climate: parent.climate }) })
					.where(eq(schema.maps.id, existing.id));
				districtId = existing.id;
				result.updated++;
			} else {
				const [row] = await tx
					.insert(schema.maps)
					.values({ name: d.name, description: d.description, climate: parent.climate, ...values })
					.returning({ id: schema.maps.id });
				districtId = row.id;
				result.created++;
			}

			const present = new Map(
				(
					await tx
						.select({ id: schema.locations.id, name: schema.locations.name, description: schema.locations.description })
						.from(schema.locations)
						.where(eq(schema.locations.mapId, districtId))
				).map((l) => [l.name.toLowerCase(), l])
			);
			// Luoghi già creati: si aggiorna solo la descrizione, se non l'ha cambiata lo staff.
			for (const l of d.locations) {
				const old = present.get(l.name.toLowerCase());
				if (old && old.description !== l.description && replaceable(old.description, l.previous)) {
					await tx.update(schema.locations).set({ description: l.description }).where(eq(schema.locations.id, old.id));
					result.descriptions++;
				}
			}
			const fresh = d.locations.filter((l) => !present.has(l.name.toLowerCase()));
			if (fresh.length) {
				await tx.insert(schema.locations).values(
					fresh.map((l, i) => ({ mapId: districtId, name: l.name, description: l.description, x: l.x, y: l.y, kind: 'chat' as const, sortOrder: i }))
				);
				result.locations += fresh.length;
			}
		}
		return result;
	});
}

export const seedNightCity = (parentId: number) => applyDistricts(parentId, NIGHT_CITY_DISTRICTS);

// ---------------------------------------------------------------------------
// Night City 2077
// ---------------------------------------------------------------------------

export type Seed2077Result = { created: number; updated: number; removed: number; moved: number; added: number; baseImageRemoved: boolean };

const RATIO_2077 = NIGHT_CITY_2077_IMAGE.width / NIGHT_CITY_2077_IMAGE.height;

async function ratioOf(file: string | null): Promise<number | null> {
	if (!file) return null;
	const f = await readImage(file);
	const size = f ? imageSize(f.bytes) : null;
	return size ? size.width / size.height : null;
}

const is2077 = (r: number | null) => r !== null && Math.abs(r - RATIO_2077) / RATIO_2077 < 0.01;

/** La mappa ha almeno un'immagine (normale o per tema) con le proporzioni della mappa 2077? */
export async function hasNightCity2077Image(map: { image: string | null; themeImages: Record<string, string> | null }) {
	for (const f of [map.image, ...Object.values(map.themeImages ?? {})]) if (is2077(await ratioOf(f))) return true;
	return false;
}

/**
 * Passa Night City alla mappa di Cyberpunk 2077:
 * - crea (o aggiorna) gli undici distretti 2077 con la loro forma;
 * - i vecchi distretti (Cyberpunk RED) passano i loro luoghi, con le chat e i messaggi, al distretto 2077
 *   corrispondente e poi vengono cancellati; i distretti con un nome sconosciuto restano com'erano;
 * - aggiunge i luoghi che mancano e mette i luoghi spostati in posizioni nuove dentro il distretto;
 * - se ci sono le versioni per tema, toglie la vecchia immagine normale con proporzioni diverse.
 * Si può rilanciare: le posizioni dei luoghi già sistemati non cambiano.
 */
export async function seedNightCity2077(parentId: number): Promise<Seed2077Result> {
	const result: Seed2077Result = { created: 0, updated: 0, removed: 0, moved: 0, added: 0, baseImageRemoved: false };
	const oldBase = await db.transaction(async (tx) => {
		const [parent] = await tx.select().from(schema.maps).where(eq(schema.maps.id, parentId)).for('update');
		if (!parent) throw new SeedError('Mappa non trovata.');
		const children = await tx.select().from(schema.maps).where(eq(schema.maps.parentMapId, parent.id));
		const byName = new Map(children.map((m) => [m.name.trim().toLowerCase(), m]));
		const target = new Map<string, number>(); // nome 2077 → id del distretto
		const reposition = new Set<number>(); // luoghi da rimettere in posizione

		for (const d of NIGHT_CITY_2077) {
			const area = boundingArea(d.points);
			const shape = { points: d.points };
			const values = { parentMapId: parent.id, areaX: area.x, areaY: area.y, areaW: area.w, areaH: area.h, shape };
			const existing = byName.get(d.name.toLowerCase());
			if (existing) {
				const changed = existing.areaX !== area.x || existing.areaY !== area.y || existing.areaW !== area.w || existing.areaH !== area.h;
				await tx
					.update(schema.maps)
					.set({ ...values, ...(existing.description.trim() === '' || changed ? { description: d.description } : {}) })
					.where(eq(schema.maps.id, existing.id));
				// Era un distretto con la forma vecchia (es. Santo Domingo di RED): i suoi luoghi vanno ripiazzati.
				if (changed) {
					const locs = await tx.select({ id: schema.locations.id }).from(schema.locations).where(eq(schema.locations.mapId, existing.id));
					for (const l of locs) reposition.add(l.id);
				}
				target.set(d.name, existing.id);
				result.updated++;
			} else {
				const [row] = await tx
					.insert(schema.maps)
					.values({ name: d.name, description: d.description, climate: parent.climate, ...values })
					.returning({ id: schema.maps.id });
				target.set(d.name, row.id);
				result.created++;
			}
		}

		// Vecchi distretti di RED (anche con i nomi alternativi): luoghi spostati, distretto cancellato.
		const redTarget = new Map<string, string>();
		for (const r of RED_DISTRICTS) for (const n of [r.name, ...(r.aliases ?? [])]) if (RED_TO_2077[r.name]) redTarget.set(n.toLowerCase(), RED_TO_2077[r.name]);
		const names2077 = new Set(NIGHT_CITY_2077.map((d) => d.name.toLowerCase()));
		for (const m of children) {
			const key = m.name.trim().toLowerCase();
			const dest = redTarget.get(key);
			if (!dest || names2077.has(key)) continue;
			const destId = target.get(dest)!;
			const moved = await tx.update(schema.locations).set({ mapId: destId }).where(eq(schema.locations.mapId, m.id)).returning({ id: schema.locations.id });
			for (const l of moved) reposition.add(l.id);
			result.moved += moved.length;
			await tx.delete(schema.maps).where(eq(schema.maps.id, m.id));
			result.removed++;
		}

		// Luoghi: quelli mancanti si aggiungono, quelli spostati si ripiazzano lontano dagli altri.
		for (const d of NIGHT_CITY_2077) {
			const districtId = target.get(d.name)!;
			const locs = await tx.select().from(schema.locations).where(eq(schema.locations.mapId, districtId));
			const present = new Set(locs.map((l) => l.name.toLowerCase()));
			const fresh = d.locations.filter((l) => !present.has(l.name.toLowerCase()));
			const toPlace = locs.filter((l) => reposition.has(l.id));
			const taken = locs.filter((l) => !reposition.has(l.id) && l.x !== null && l.y !== null).map((l) => [l.x!, l.y!] as [number, number]);
			const spots = spreadPoints({ points: d.points }, toPlace.length + fresh.length, taken);
			for (const [i, l] of toPlace.entries()) {
				await tx.update(schema.locations).set({ x: spots[i][0], y: spots[i][1] }).where(eq(schema.locations.id, l.id));
			}
			if (fresh.length) {
				await tx.insert(schema.locations).values(
					fresh.map((l, i) => ({
						mapId: districtId,
						name: l.name,
						description: l.description,
						x: spots[toPlace.length + i][0],
						y: spots[toPlace.length + i][1],
						kind: 'chat' as const,
						sortOrder: locs.length + i
					}))
				);
				result.added += fresh.length;
			}
		}

		// La vecchia immagine normale (RED) non combacia con le forme nuove: se ci sono le versioni per tema, si toglie.
		const hasThemes = Object.keys(parent.themeImages ?? {}).length > 0;
		if (hasThemes && parent.image && !is2077(await ratioOf(parent.image))) {
			await tx.update(schema.maps).set({ image: null }).where(eq(schema.maps.id, parent.id));
			result.baseImageRemoved = true;
			return parent.image;
		}
		return null;
	});
	if (oldBase) await deleteImage(oldBase);
	return result;
}
