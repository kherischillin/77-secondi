import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { createShop, deleteShop, listShops, ShopError, updateShop } from '#lib/server/shops.ts';
import { readShopForm } from '#lib/shops.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'items.manage');
	return { shops: await listShops(true) };
};

export const actions: Actions = {
	crea: async (event) => {
		const { user } = requireCapability(event, 'items.manage');
		const parsed = readShopForm(await event.request.formData());
		if (!parsed.success) return fail(400, { action: 'crea', errors: fieldErrors(parsed.error) });
		try {
			const shop = await createShop(parsed.data);
			await audit({ actorUserId: user.id, action: 'shop.create', targetType: 'shop', targetId: shop.id, details: { nome: shop.name }, ip: clientIp(event) });
			return { action: 'crea', success: `Negozio "${shop.name}" creato. Ora assegnagli gli oggetti da Oggetti e mercato.` };
		} catch (e) {
			if (e instanceof ShopError) return fail(400, { action: 'crea', errors: { name: e.message } as Record<string, string> });
			throw e;
		}
	},
	modifica: async (event) => {
		const { user } = requireCapability(event, 'items.manage');
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const parsed = readShopForm(form);
		if (!parsed.success) return fail(400, { action: 'modifica', id, error: parsed.error.issues[0].message });
		try {
			const shop = await updateShop(id, parsed.data);
			if (!shop) return fail(404, { action: 'modifica', id, error: 'Negozio non trovato.' });
			await audit({ actorUserId: user.id, action: 'shop.update', targetType: 'shop', targetId: shop.id, details: { nome: shop.name, aperto: shop.isOpen }, ip: clientIp(event) });
			return { action: 'modifica', id, success: `Negozio "${shop.name}" salvato.` };
		} catch (e) {
			if (e instanceof ShopError) return fail(400, { action: 'modifica', id, error: e.message });
			throw e;
		}
	},
	elimina: async (event) => {
		const { user } = requireCapability(event, 'items.manage');
		const id = Number((await event.request.formData()).get('id'));
		const shop = await deleteShop(id);
		if (!shop) return fail(404, { action: 'elimina', id, error: 'Negozio non trovato.' });
		await audit({ actorUserId: user.id, action: 'shop.delete', targetType: 'shop', targetId: shop.id, details: { nome: shop.name }, ip: clientIp(event) });
		return { action: 'elimina', success: `Negozio "${shop.name}" cancellato: i suoi oggetti ora sono tra gli «Altri articoli».` };
	}
};
