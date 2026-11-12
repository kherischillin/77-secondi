import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';
import { imageSize, readImage } from '../uploads.ts';
import { wouldCycle } from '../../districts.ts';
import { NIGHT_CITY_DISTRICTS, NIGHT_CITY_IMAGE, type SeedDistrict } from './night-city.ts';

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
