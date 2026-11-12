import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { handOver, inventory, ItemError, setEquipped } from '#lib/server/items.ts';
import { balances } from '#lib/server/money.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { listSkills, listStats } from '#lib/server/sheet.ts';
import { audit } from '#lib/server/audit.ts';
import { fullName } from '#lib/format.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const [items, purse, economy, stats, skills] = await Promise.all([
		inventory(character.id),
		balances(character.id),
		getEconomy(),
		listStats(),
		listSkills()
	]);
	return {
		me: { id: character.id, name: fullName(character) },
		items,
		purse,
		currency: economy.currencyName,
		names: { stats: stats.map((s) => ({ id: s.id, name: s.name })), skills: skills.map((s) => ({ id: s.id, name: s.name })) }
	};
};

const idOf = (form: FormData) => Number(form.get('id'));

export const actions: Actions = {
	indossa: async (event) => {
		const { character } = requireCharacter(event);
		try {
			const item = await setEquipped(character.id, idOf(await event.request.formData()), true);
			return { success: `Ora indossi: ${item.name}.` };
		} catch (e) {
			if (e instanceof ItemError) return fail(400, { error: e.message });
			throw e;
		}
	},
	togli: async (event) => {
		const { character } = requireCharacter(event);
		try {
			const item = await setEquipped(character.id, idOf(await event.request.formData()), false);
			return { success: `Hai tolto: ${item.name}.` };
		} catch (e) {
			if (e instanceof ItemError) return fail(400, { error: e.message });
			throw e;
		}
	},
	cedi: async (event) => {
		const { user, character } = requireCharacter(event);
		const form = await event.request.formData();
		const quantity = Number(form.get('quantity') ?? 1);
		const to = String(form.get('to') ?? '');
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) return fail(400, { error: 'Quantità non valida.' });
		try {
			const { item, to: target } = await handOver(character.id, idOf(form), to, quantity);
			await audit({
				actorUserId: user.id,
				action: 'item.handover',
				targetType: 'character',
				targetId: target.id,
				details: { da: character.name, a: target.name, oggetto: item.name, quantita: quantity },
				ip: clientIp(event)
			});
			return { success: `Hai ceduto ${quantity > 1 ? `${quantity} × ` : ''}${item.name} a ${target.name}.` };
		} catch (e) {
			if (e instanceof ItemError) return fail(400, { error: e.message });
			throw e;
		}
	}
};
