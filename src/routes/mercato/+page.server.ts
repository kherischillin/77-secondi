import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { inventory, ItemError, sellItem } from '#lib/server/items.ts';
import { balances } from '#lib/server/money.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { listShops, unassignedWaresCount } from '#lib/server/shops.ts';
import { sellPrice } from '#lib/economy.ts';
import { audit } from '#lib/server/audit.ts';

/** Il mercato: l'elenco dei negozi e il banco dove si rivende. */
export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const [shops, others, mine, purse, economy] = await Promise.all([
		listShops(),
		unassignedWaresCount(),
		inventory(character.id),
		balances(character.id),
		getEconomy()
	]);
	return {
		shops: shops.map((s) => ({ id: s.id, name: s.name, tagline: s.tagline, description: s.description, icon: s.icon, wares: s.wares })),
		others,
		sellable: mine
			.filter((i) => !i.equipped && i.item.sellable)
			.map((i) => ({ id: i.id, name: i.item.name, quantity: i.quantity, unitPrice: sellPrice(i.item.price, economy.sellbackPercent) })),
		purse,
		currency: economy.currencyName,
		sellbackPercent: economy.sellbackPercent
	};
};

export const actions: Actions = {
	vendi: async (event) => {
		const { user, character } = requireCharacter(event);
		const form = await event.request.formData();
		const quantity = Number(form.get('quantity') ?? 1);
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return fail(400, { error: 'Quantità non valida.' });
		const economy = await getEconomy();
		try {
			const { item, earned } = await sellItem(character.id, Number(form.get('id')), quantity, economy.sellbackPercent);
			await audit({ actorUserId: user.id, action: 'market.sell', targetType: 'item', targetId: item.id, details: { personaggio: character.name, oggetto: item.name, quantita: quantity, ricavo: earned }, ip: clientIp(event) });
			return { success: `Hai venduto ${quantity > 1 ? `${quantity} × ` : ''}${item.name}.` };
		} catch (e) {
			if (e instanceof ItemError) return fail(400, { error: e.message });
			throw e;
		}
	}
};
