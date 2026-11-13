import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDatabase, hasTestDb, makeCharacter, makeUser, outcomes } from './db.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { ItemError, buyItem, giveItem, handOver, inventory, sellItem, setEquipped, useItem } from '#lib/server/items.ts';
import { balances } from '#lib/server/money.ts';
import { sellPrice } from '#lib/economy.ts';

type NewItem = typeof schema.items.$inferInsert;

describe.skipIf(!hasTestDb)('oggetti e mercato (con database)', () => {
	let userId: number;
	let shopId: number;

	const makeItem = async (values: Partial<NewItem> = {}) => {
		const [item] = await db
			.insert(schema.items)
			.values({ name: `Oggetto ${Math.random().toString(36).slice(2, 8)}`, price: 100, forSale: true, shopId, ...values })
			.returning();
		return item;
	};
	const stockOf = async (id: number) => (await db.select({ stock: schema.items.stock }).from(schema.items).where(eq(schema.items.id, id)))[0].stock;
	const owned = async (characterId: number, itemId: number) =>
		(await inventory(characterId)).filter((r) => r.item.id === itemId).reduce((n, r) => n + r.quantity, 0);

	beforeAll(async () => {
		await freshDatabase();
		userId = (await makeUser()).id;
		const [shop] = await db.select({ id: schema.shops.id }).from(schema.shops).limit(1);
		shopId = shop.id;
	});

	it('comprare toglie i contanti, scala le scorte e mette l’oggetto in inventario', async () => {
		const item = await makeItem({ price: 40, stock: 5 });
		const c = await makeCharacter(userId, { cash: 100 });
		const { cost } = await buyItem(c.id, item.id, 2, shopId);
		expect(cost).toBe(80);
		expect((await balances(c.id)).money).toBe(20);
		expect(await stockOf(item.id)).toBe(3);
		expect(await owned(c.id, item.id)).toBe(2);
	});

	it('senza contanti non si compra e non cambia niente', async () => {
		const item = await makeItem({ price: 500, stock: 5 });
		const c = await makeCharacter(userId, { cash: 499 });
		await expect(buyItem(c.id, item.id, 1, shopId)).rejects.toBeInstanceOf(ItemError);
		expect((await balances(c.id)).money).toBe(499);
		expect(await stockOf(item.id)).toBe(5);
		expect(await owned(c.id, item.id)).toBe(0);
	});

	it('non si compra un oggetto fuori vendita, archiviato o di un altro negozio', async () => {
		const c = await makeCharacter(userId, { cash: 1000 });
		const notForSale = await makeItem({ forSale: false });
		const archived = await makeItem({ archived: true });
		const elsewhere = await makeItem({ shopId: null });
		await expect(buyItem(c.id, notForSale.id, 1, shopId)).rejects.toBeInstanceOf(ItemError);
		await expect(buyItem(c.id, archived.id, 1, shopId)).rejects.toBeInstanceOf(ItemError);
		await expect(buyItem(c.id, elsewhere.id, 1, shopId)).rejects.toBeInstanceOf(ItemError);
		expect((await balances(c.id)).money).toBe(1000);
	});

	it('l’ultimo pezzo non viene venduto a due acquirenti simultanei', async () => {
		const item = await makeItem({ price: 10, stock: 1 });
		const buyers = await Promise.all(Array.from({ length: 6 }, () => makeCharacter(userId, { cash: 100 })));
		const result = await outcomes(buyers.map((b) => buyItem(b.id, item.id, 1, shopId)));
		expect(result.ok).toBe(1);
		expect(result.failed).toBe(5);
		expect(await stockOf(item.id)).toBe(0);
		const paid = (await Promise.all(buyers.map((b) => balances(b.id)))).filter((b) => b.money === 90);
		expect(paid).toHaveLength(1);
	});

	it('rivendere restituisce la percentuale prevista e rimette il pezzo in negozio', async () => {
		const item = await makeItem({ price: 200, stock: 0 });
		const c = await makeCharacter(userId);
		await giveItem(c.id, item.id, 3);
		const [row] = await inventory(c.id);
		const { earned } = await sellItem(c.id, row.id, 2, 50);
		expect(earned).toBe(sellPrice(200, 50) * 2);
		expect((await balances(c.id)).money).toBe(earned);
		expect(await owned(c.id, item.id)).toBe(1);
		expect(await stockOf(item.id)).toBe(2);
	});

	it('non si rivende più di quanto si possiede, né un oggetto non rivendibile', async () => {
		const item = await makeItem({ price: 200 });
		const locked = await makeItem({ sellable: false });
		const c = await makeCharacter(userId);
		await giveItem(c.id, item.id, 1);
		await giveItem(c.id, locked.id, 1);
		const rows = await inventory(c.id);
		const mine = rows.find((r) => r.item.id === item.id)!;
		const lockedRow = rows.find((r) => r.item.id === locked.id)!;
		await expect(sellItem(c.id, mine.id, 2, 50)).rejects.toBeInstanceOf(ItemError);
		await expect(sellItem(c.id, lockedRow.id, 1, 50)).rejects.toBeInstanceOf(ItemError);
		// La vendita rifiutata viene annullata per intero: l'oggetto resta al suo posto e non arriva denaro.
		expect(await owned(c.id, locked.id)).toBe(1);
		expect((await balances(c.id)).money).toBe(0);
	});

	it('la stessa riga venduta due volte insieme paga una volta sola', async () => {
		const item = await makeItem({ price: 100 });
		const c = await makeCharacter(userId);
		await giveItem(c.id, item.id, 1);
		const [row] = await inventory(c.id);
		const result = await outcomes([sellItem(c.id, row.id, 1, 50), sellItem(c.id, row.id, 1, 50), sellItem(c.id, row.id, 1, 50)]);
		expect(result.ok).toBe(1);
		expect((await balances(c.id)).money).toBe(sellPrice(100, 50));
	});

	it('non si vende né si cede l’oggetto di un altro personaggio', async () => {
		const item = await makeItem();
		const owner = await makeCharacter(userId);
		const thief = await makeCharacter(userId);
		await makeCharacter(userId, { name: 'Complice' });
		await giveItem(owner.id, item.id, 1);
		const [row] = await inventory(owner.id);
		await expect(sellItem(thief.id, row.id, 1, 50)).rejects.toBeInstanceOf(ItemError);
		await expect(handOver(thief.id, row.id, 'Complice', 1)).rejects.toBeInstanceOf(ItemError);
		await expect(useItem(thief.id, row.id)).rejects.toBeInstanceOf(ItemError);
		expect(await owned(owner.id, item.id)).toBe(1);
	});

	it('cedere un oggetto lo sposta da un inventario all’altro', async () => {
		const item = await makeItem();
		const from = await makeCharacter(userId);
		const to = await makeCharacter(userId, { name: 'Amica' });
		await giveItem(from.id, item.id, 3);
		const [row] = await inventory(from.id);
		await handOver(from.id, row.id, 'Amica', 2);
		expect(await owned(from.id, item.id)).toBe(1);
		expect(await owned(to.id, item.id)).toBe(2);
	});

	it('un oggetto indossato non si vende finché non lo si toglie', async () => {
		const item = await makeItem({ slot: 'head' });
		const c = await makeCharacter(userId);
		await giveItem(c.id, item.id, 1);
		const [row] = await inventory(c.id);
		await setEquipped(c.id, row.id, true);
		await expect(sellItem(c.id, row.id, 1, 50)).rejects.toBeInstanceOf(ItemError);
		await setEquipped(c.id, row.id, false);
		await sellItem(c.id, row.id, 1, 50);
		expect(await owned(c.id, item.id)).toBe(0);
	});

	it('un consumabile si consuma usandolo, un oggetto normale no', async () => {
		const potion = await makeItem({ consumable: true });
		const tool = await makeItem();
		const c = await makeCharacter(userId);
		await giveItem(c.id, potion.id, 2);
		await giveItem(c.id, tool.id, 1);
		const rows = await inventory(c.id);
		await useItem(c.id, rows.find((r) => r.item.id === potion.id)!.id);
		await useItem(c.id, rows.find((r) => r.item.id === tool.id)!.id);
		expect(await owned(c.id, potion.id)).toBe(1);
		expect(await owned(c.id, tool.id)).toBe(1);
	});
});
