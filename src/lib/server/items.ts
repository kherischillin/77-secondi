import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { canEquip, sellPrice, stacks, type ItemForm } from '../economy.ts';
import { mediaUrl } from './uploads.ts';
import { move } from './money.ts';
import { findCharacterByName } from './money.ts';
import { validShopId } from './shops.ts';

/**
 * Oggetti: catalogo, inventario dei personaggi, equipaggiamento, mercato.
 * Come per il denaro, ogni passaggio di mano è una transazione con aggiornamenti condizionati.
 */

export class ItemError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ItemRow = typeof schema.items.$inferSelect;

export function itemView(i: ItemRow) {
	return {
		id: i.id,
		shopId: i.shopId,
		name: i.name,
		description: i.description,
		imageUrl: mediaUrl(i.image),
		category: i.category,
		slot: i.slot,
		price: i.price,
		forSale: i.forSale,
		stock: i.stock,
		sellable: i.sellable,
		consumable: i.consumable,
		bonuses: i.bonuses,
		archived: i.archived
	};
}
export type ItemView = ReturnType<typeof itemView>;

// ---------------------------------------------------------------------------
// Catalogo (staff)
// ---------------------------------------------------------------------------

export async function listCatalog() {
	const rows = await db.select().from(schema.items).orderBy(asc(schema.items.archived), asc(schema.items.category), asc(schema.items.name));
	return rows.map(itemView);
}

export async function getItem(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [i] = await db.select().from(schema.items).where(eq(schema.items.id, id));
	return i ?? null;
}

export async function createItem(data: ItemForm, image: string | null) {
	const [i] = await db.insert(schema.items).values({ ...data, shopId: await validShopId(data.shopId), image }).returning();
	return i;
}

export async function updateItem(id: number, data: Partial<ItemForm> & { archived?: boolean }, image?: string | null) {
	if ('shopId' in data) data = { ...data, shopId: await validShopId(data.shopId) };
	const [i] = await db
		.update(schema.items)
		.set(image === undefined ? data : { ...data, image })
		.where(eq(schema.items.id, id))
		.returning();
	return i ?? null;
}

/** Quanti pezzi di questo oggetto sono in giro (per avvisare prima di cancellare). */
export async function ownedCount(itemId: number) {
	const [{ n }] = await db
		.select({ n: sql<number>`coalesce(sum(${schema.characterItems.quantity}), 0)::int` })
		.from(schema.characterItems)
		.where(eq(schema.characterItems.itemId, itemId));
	return n;
}

export async function deleteItem(id: number) {
	const [i] = await db.delete(schema.items).where(eq(schema.items.id, id)).returning();
	return i ?? null;
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

/** Aggiunge pezzi all'inventario: impilati se l'oggetto non si indossa, uno per riga altrimenti. */
async function addToInventory(tx: Tx, characterId: number, item: ItemRow, quantity: number) {
	if (stacks(item.slot)) {
		const [existing] = await tx
			.select({ id: schema.characterItems.id })
			.from(schema.characterItems)
			.where(and(eq(schema.characterItems.characterId, characterId), eq(schema.characterItems.itemId, item.id)))
			.limit(1)
			.for('update');
		if (existing) {
			await tx
				.update(schema.characterItems)
				.set({ quantity: sql`${schema.characterItems.quantity} + ${quantity}` })
				.where(eq(schema.characterItems.id, existing.id));
		} else {
			await tx.insert(schema.characterItems).values({ characterId, itemId: item.id, quantity });
		}
		return;
	}
	await tx.insert(schema.characterItems).values(Array.from({ length: quantity }, () => ({ characterId, itemId: item.id, quantity: 1 })));
}

/**
 * Toglie pezzi da una riga dell'inventario (solo se appartiene al personaggio, non è indossata
 * e ne ha abbastanza). Restituisce l'oggetto, o null se l'operazione non è possibile.
 */
async function takeFromInventory(tx: Tx, characterId: number, characterItemId: number, quantity: number) {
	const mine = and(
		eq(schema.characterItems.id, characterItemId),
		eq(schema.characterItems.characterId, characterId),
		eq(schema.characterItems.equipped, false)
	);
	// Ultimi pezzi: la riga sparisce. Altrimenti si scala la quantità. Entrambe le operazioni sono condizionate.
	let [row] = await tx
		.delete(schema.characterItems)
		.where(and(mine, eq(schema.characterItems.quantity, quantity)))
		.returning();
	if (!row) {
		[row] = await tx
			.update(schema.characterItems)
			.set({ quantity: sql`${schema.characterItems.quantity} - ${quantity}` })
			.where(and(mine, sql`${schema.characterItems.quantity} > ${quantity}`))
			.returning();
	}
	if (!row) return null;
	const [item] = await tx.select().from(schema.items).where(eq(schema.items.id, row.itemId));
	return item;
}

export async function inventory(characterId: number) {
	const rows = await db
		.select({ ci: schema.characterItems, item: schema.items })
		.from(schema.characterItems)
		.innerJoin(schema.items, eq(schema.characterItems.itemId, schema.items.id))
		.where(eq(schema.characterItems.characterId, characterId))
		.orderBy(asc(schema.items.category), asc(schema.items.name), asc(schema.characterItems.id));
	return rows.map(({ ci, item }) => ({
		id: ci.id,
		quantity: ci.quantity,
		equipped: ci.equipped,
		acquiredAt: ci.acquiredAt.toISOString(),
		item: itemView(item)
	}));
}

/** Oggetti indossati: si vedono nella scheda (sono la parte "visibile" in gioco). */
export async function equippedOf(characterId: number) {
	const rows = await db
		.select({ item: schema.items })
		.from(schema.characterItems)
		.innerJoin(schema.items, eq(schema.characterItems.itemId, schema.items.id))
		.where(and(eq(schema.characterItems.characterId, characterId), eq(schema.characterItems.equipped, true)))
		.orderBy(asc(schema.items.slot), asc(schema.items.name));
	return rows.map((r) => itemView(r.item));
}

export async function setEquipped(characterId: number, characterItemId: number, equipped: boolean) {
	return db.transaction(async (tx) => {
		// Blocca il personaggio: due richieste simultanee non possono superare il limite della posizione.
		await tx.execute(sql`select id from ${schema.characters} where id = ${characterId} for update`);
		const [row] = await tx
			.select({ ci: schema.characterItems, item: schema.items })
			.from(schema.characterItems)
			.innerJoin(schema.items, eq(schema.characterItems.itemId, schema.items.id))
			.where(and(eq(schema.characterItems.id, characterItemId), eq(schema.characterItems.characterId, characterId)));
		if (!row) throw new ItemError('Oggetto non trovato nel tuo inventario.');
		if (equipped) {
			if (row.ci.equipped) return row.item;
			const [{ n }] = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(schema.characterItems)
				.innerJoin(schema.items, eq(schema.characterItems.itemId, schema.items.id))
				.where(and(eq(schema.characterItems.characterId, characterId), eq(schema.characterItems.equipped, true), eq(schema.items.slot, row.item.slot)));
			const check = canEquip(row.item.slot, n);
			if (!check.ok) throw new ItemError(check.reason);
		}
		await tx.update(schema.characterItems).set({ equipped }).where(eq(schema.characterItems.id, characterItemId));
		return row.item;
	});
}

/** Consegna di un oggetto da parte dello staff o di un Master (premio di quest...). */
export async function giveItem(characterId: number, itemId: number, quantity: number) {
	return db.transaction(async (tx) => {
		const [item] = await tx.select().from(schema.items).where(eq(schema.items.id, itemId));
		if (!item || item.archived) throw new ItemError('Oggetto non trovato.');
		await addToInventory(tx, characterId, item, quantity);
		return item;
	});
}

/** Lo staff toglie un oggetto a un personaggio (anche se indossato). */
export async function confiscate(characterItemId: number) {
	return db.transaction(async (tx) => {
		const [row] = await tx.delete(schema.characterItems).where(eq(schema.characterItems.id, characterItemId)).returning();
		if (!row) return null;
		const [item] = await tx.select().from(schema.items).where(eq(schema.items.id, row.itemId));
		return { row, item };
	});
}

/** Un personaggio cede un oggetto a un altro. */
export async function handOver(fromCharacterId: number, characterItemId: number, toName: string, quantity: number) {
	const to = await findCharacterByName(toName);
	if (!to) throw new ItemError(`Nessun personaggio si chiama "${toName}".`);
	if (to.id === fromCharacterId) throw new ItemError('Non puoi cedere un oggetto a te stesso.');
	const item = await db.transaction(async (tx) => {
		const item = await takeFromInventory(tx, fromCharacterId, characterItemId, quantity);
		if (!item) throw new ItemError('Non hai abbastanza pezzi di questo oggetto (o lo stai indossando).');
		await addToInventory(tx, to.id, item, quantity);
		return item;
	});
	return { item, to };
}

/** Usa un oggetto: se è consumabile ne toglie un pezzo. Restituisce l'oggetto usato. */
export async function useItem(characterId: number, characterItemId: number) {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ ci: schema.characterItems, item: schema.items })
			.from(schema.characterItems)
			.innerJoin(schema.items, eq(schema.characterItems.itemId, schema.items.id))
			.where(and(eq(schema.characterItems.id, characterItemId), eq(schema.characterItems.characterId, characterId)));
		if (!row) throw new ItemError('Oggetto non trovato nel tuo inventario.');
		if (row.item.consumable) {
			const taken = await takeFromInventory(tx, characterId, characterItemId, 1);
			if (!taken) throw new ItemError('Non puoi usare un oggetto che stai indossando.');
		}
		return { item: row.item, consumed: row.item.consumable };
	});
}

// ---------------------------------------------------------------------------
// Mercato
// ---------------------------------------------------------------------------

/** Oggetti in vendita in un negozio (`null` = quelli senza negozio, «Altri articoli»). */
export async function listMarket(shopId: number | null) {
	const rows = await db
		.select()
		.from(schema.items)
		.where(
			and(
				eq(schema.items.forSale, true),
				eq(schema.items.archived, false),
				shopId === null ? isNull(schema.items.shopId) : eq(schema.items.shopId, shopId)
			)
		)
		.orderBy(asc(schema.items.category), asc(schema.items.price), asc(schema.items.name));
	return rows.map(itemView);
}

/** Compra un oggetto nel negozio `shopId` (null = «Altri articoli»): deve essere in vendita proprio lì. */
export async function buyItem(characterId: number, itemId: number, quantity: number, shopId: number | null) {
	return db.transaction(async (tx) => {
		// Blocca l'oggetto: l'ultima copia disponibile non può essere venduta a due persone.
		const [item] = await tx.select().from(schema.items).where(eq(schema.items.id, itemId)).for('update');
		if (!item || !item.forSale || item.archived || item.shopId !== shopId) throw new ItemError('Questo oggetto non è in vendita qui.');
		if (item.stock !== null && item.stock < quantity) {
			throw new ItemError(item.stock === 0 ? 'Esaurito.' : `Ne restano solo ${item.stock}.`);
		}
		const cost = item.price * quantity;
		const note = quantity > 1 ? `${item.name} ×${quantity}` : item.name;
		if (!(await move(tx, characterId, 'cash', -cost, 'purchase', { note }))) {
			throw new ItemError('Non hai abbastanza contanti.');
		}
		if (item.stock !== null) {
			await tx.update(schema.items).set({ stock: item.stock - quantity }).where(eq(schema.items.id, item.id));
		}
		await addToInventory(tx, characterId, item, quantity);
		return { item, cost };
	});
}

export async function sellItem(characterId: number, characterItemId: number, quantity: number, sellbackPercent: number) {
	return db.transaction(async (tx) => {
		const item = await takeFromInventory(tx, characterId, characterItemId, quantity);
		if (!item) throw new ItemError('Non hai abbastanza pezzi di questo oggetto (o lo stai indossando).');
		if (!item.sellable) throw new ItemError('Questo oggetto non si può rivendere.');
		const earned = sellPrice(item.price, sellbackPercent) * quantity;
		const note = quantity > 1 ? `${item.name} ×${quantity}` : item.name;
		await move(tx, characterId, 'cash', earned, 'sale', { note });
		if (item.stock !== null) {
			await tx.update(schema.items).set({ stock: sql`${schema.items.stock} + ${quantity}` }).where(eq(schema.items.id, item.id));
		}
		return { item, earned };
	});
}
