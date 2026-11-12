import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { createItem, listCatalog } from '#lib/server/items.ts';
import { shopOptions } from '#lib/server/shops.ts';
import { listSkills, listStats } from '#lib/server/sheet.ts';
import { saveImage, UploadError } from '#lib/server/uploads.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { readItemForm } from '#lib/economy.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'items.manage');
	const [items, stats, skills, economy, shops] = await Promise.all([listCatalog(), listStats(), listSkills(), getEconomy(), shopOptions()]);
	return {
		items,
		shops,
		currency: economy.currencyName,
		categories: [...new Set(items.map((i) => i.category).filter(Boolean))],
		names: { stats: stats.map((s) => ({ id: s.id, name: s.name })), skills: skills.map((s) => ({ id: s.id, name: s.name })) }
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireCapability(event, 'items.manage');
		const form = await event.request.formData();
		const parsed = readItemForm(form);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		let image: string | null;
		try {
			image = await saveImage(form.get('image'));
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { errors: { image: e.message } as Record<string, string> });
			throw e;
		}
		const item = await createItem(parsed.data, image);
		await audit({ actorUserId: user.id, action: 'item.create', targetType: 'item', targetId: item.id, details: { nome: item.name, prezzo: item.price }, ip: clientIp(event) });
		redirect(303, `/gestione/oggetti/${item.id}?nuovo=1`);
	}
};
