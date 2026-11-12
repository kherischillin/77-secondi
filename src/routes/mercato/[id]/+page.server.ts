import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { buyItem, ItemError, listMarket } from '#lib/server/items.ts';
import { balances } from '#lib/server/money.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { listSkills, listStats } from '#lib/server/sheet.ts';
import { getShop } from '#lib/server/shops.ts';
import { audit } from '#lib/server/audit.ts';

/** Il negozio richiesto: un id, oppure "varie" per gli oggetti senza negozio. Chiuso o inesistente = 404. */
async function shopOf(param: string) {
	if (param === 'varie') return { id: null, name: 'Altri articoli', tagline: 'Merce varia', description: '', icon: 'stall' };
	const shop = await getShop(Number(param));
	if (!shop || !shop.isOpen) error(404, 'Negozio non trovato.');
	return { id: shop.id, name: shop.name, tagline: shop.tagline, description: shop.description, icon: shop.icon };
}

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const shop = await shopOf(event.params.id);
	const [market, purse, economy, stats, skills] = await Promise.all([listMarket(shop.id), balances(character.id), getEconomy(), listStats(), listSkills()]);
	if (shop.id === null && market.length === 0) error(404, 'Negozio non trovato.');
	return {
		shop,
		market,
		purse,
		currency: economy.currencyName,
		names: { stats: stats.map((s) => ({ id: s.id, name: s.name })), skills: skills.map((s) => ({ id: s.id, name: s.name })) }
	};
};

export const actions: Actions = {
	compra: async (event) => {
		const { user, character } = requireCharacter(event);
		const shop = await shopOf(event.params.id);
		const form = await event.request.formData();
		const q = Number(form.get('quantity') ?? 1);
		if (!Number.isInteger(q) || q < 1 || q > 1000) return fail(400, { error: 'Quantità non valida.' });
		try {
			const { item, cost } = await buyItem(character.id, Number(form.get('itemId')), q, shop.id);
			await audit({ actorUserId: user.id, action: 'market.buy', targetType: 'item', targetId: item.id, details: { personaggio: character.name, oggetto: item.name, negozio: shop.name, quantita: q, spesa: cost }, ip: clientIp(event) });
			return { success: `Hai comprato ${q > 1 ? `${q} × ` : ''}${item.name}.` };
		} catch (e) {
			if (e instanceof ItemError) return fail(400, { error: e.message });
			throw e;
		}
	}
};
