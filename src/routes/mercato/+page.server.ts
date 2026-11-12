import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { buyItem, inventory, ItemError, listMarket, sellItem } from '#lib/server/items.ts';
import { balances } from '#lib/server/money.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { listSkills, listStats } from '#lib/server/sheet.ts';
import { sellPrice } from '#lib/economy.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const [market, mine, purse, economy, stats, skills] = await Promise.all([
		listMarket(),
		inventory(character.id),
		balances(character.id),
		getEconomy(),
		listStats(),
		listSkills()
	]);
	return {
		market,
		sellable: mine
			.filter((i) => !i.equipped && i.item.sellable)
			.map((i) => ({ id: i.id, name: i.item.name, quantity: i.quantity, unitPrice: sellPrice(i.item.price, economy.sellbackPercent) })),
		purse,
		currency: economy.currencyName,
		sellbackPercent: economy.sellbackPercent,
		names: { stats: stats.map((s) => ({ id: s.id, name: s.name })), skills: skills.map((s) => ({ id: s.id, name: s.name })) }
	};
};

function quantityOf(form: FormData) {
	const q = Number(form.get('quantity') ?? 1);
	return Number.isInteger(q) && q >= 1 && q <= 1000 ? q : null;
}

export const actions: Actions = {
	compra: async (event) => {
		const { user, character } = requireCharacter(event);
		const form = await event.request.formData();
		const quantity = quantityOf(form);
		if (!quantity) return fail(400, { error: 'Quantità non valida.' });
		try {
			const { item, cost } = await buyItem(character.id, Number(form.get('itemId')), quantity);
			await audit({ actorUserId: user.id, action: 'market.buy', targetType: 'item', targetId: item.id, details: { personaggio: character.name, oggetto: item.name, quantita: quantity, spesa: cost }, ip: clientIp(event) });
			return { success: `Hai comprato ${quantity > 1 ? `${quantity} × ` : ''}${item.name}.` };
		} catch (e) {
			if (e instanceof ItemError) return fail(400, { error: e.message });
			throw e;
		}
	},
	vendi: async (event) => {
		const { user, character } = requireCharacter(event);
		const form = await event.request.formData();
		const quantity = quantityOf(form);
		if (!quantity) return fail(400, { error: 'Quantità non valida.' });
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
