import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import type { ShopForm } from '../shops.ts';

/** Negozi del mercato (Uffici → Mercato): ognuno vende i suoi oggetti. */

export class ShopError extends Error {}

const isDuplicate = (e: unknown) => String((e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code ?? '').includes('23505');

/** Negozi con il numero di articoli in vendita. `all` include quelli chiusi (per lo staff). */
export async function listShops(all = false) {
	const wares = db
		.select({ shopId: schema.items.shopId, n: count().as('n') })
		.from(schema.items)
		.where(and(eq(schema.items.forSale, true), eq(schema.items.archived, false)))
		.groupBy(schema.items.shopId)
		.as('wares');
	const rows = await db
		.select({ shop: schema.shops, wares: wares.n })
		.from(schema.shops)
		.leftJoin(wares, eq(wares.shopId, schema.shops.id))
		.where(all ? undefined : eq(schema.shops.isOpen, true))
		.orderBy(asc(schema.shops.sortOrder), asc(schema.shops.name));
	return rows.map((r) => ({ ...r.shop, wares: Number(r.wares ?? 0) }));
}

/** Oggetti in vendita che non appartengono a nessun negozio («Altri articoli»). */
export async function unassignedWaresCount() {
	const [row] = await db
		.select({ n: count() })
		.from(schema.items)
		.where(and(eq(schema.items.forSale, true), eq(schema.items.archived, false), isNull(schema.items.shopId)));
	return Number(row?.n ?? 0);
}

export async function getShop(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [s] = await db.select().from(schema.shops).where(eq(schema.shops.id, id));
	return s ?? null;
}

/** Elenco breve per i menu a tendina dello staff. */
export async function shopOptions() {
	return db.select({ id: schema.shops.id, name: schema.shops.name, isOpen: schema.shops.isOpen }).from(schema.shops).orderBy(asc(schema.shops.sortOrder), asc(schema.shops.name));
}

export async function createShop(data: ShopForm) {
	try {
		const [s] = await db.insert(schema.shops).values(data).returning();
		return s;
	} catch (e) {
		if (isDuplicate(e)) throw new ShopError('Esiste già un negozio con questo nome.');
		throw e;
	}
}

export async function updateShop(id: number, data: ShopForm) {
	try {
		const [s] = await db.update(schema.shops).set(data).where(eq(schema.shops.id, id)).returning();
		return s ?? null;
	} catch (e) {
		if (isDuplicate(e)) throw new ShopError('Esiste già un negozio con questo nome.');
		throw e;
	}
}

/** Cancella un negozio: i suoi oggetti restano e finiscono tra gli «Altri articoli». */
export async function deleteShop(id: number) {
	const [s] = await db.delete(schema.shops).where(eq(schema.shops.id, id)).returning();
	return s ?? null;
}

/** Un id di negozio valido, oppure null (per non salvare riferimenti a negozi inesistenti). */
export async function validShopId(id: number | null | undefined) {
	if (!id) return null;
	const [s] = await db.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.id, id));
	return s?.id ?? null;
}
