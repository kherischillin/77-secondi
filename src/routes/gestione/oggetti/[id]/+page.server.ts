import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { deleteItem, getItem, giveItem, itemView, ItemError, listCatalog, ownedCount, updateItem } from '#lib/server/items.ts';
import { findCharacterByName } from '#lib/server/money.ts';
import { listSkills, listStats } from '#lib/server/sheet.ts';
import { deleteImage, saveImage, UploadError } from '#lib/server/uploads.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { readItemForm } from '#lib/economy.ts';
import { shopOptions } from '#lib/server/shops.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

async function itemOr404(event: RequestEvent) {
	const item = await getItem(Number(event.params.id));
	if (!item) error(404, 'Oggetto non trovato.');
	return item;
}

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'items.manage');
	const item = await itemOr404(event);
	const [stats, skills, owned, economy, catalog, shops] = await Promise.all([listStats(), listSkills(), ownedCount(item.id), getEconomy(), listCatalog(), shopOptions()]);
	return {
		shops,
		item: itemView(item),
		owned,
		currency: economy.currencyName,
		isNew: event.url.searchParams.has('nuovo'),
		categories: [...new Set(catalog.map((i) => i.category).filter(Boolean))],
		names: { stats: stats.map((s) => ({ id: s.id, name: s.name })), skills: skills.map((s) => ({ id: s.id, name: s.name })) }
	};
};

export const actions: Actions = {
	salva: async (event) => {
		const { user } = requireCapability(event, 'items.manage');
		const item = await itemOr404(event);
		const form = await event.request.formData();
		const parsed = readItemForm(form);
		if (!parsed.success) return fail(400, { action: 'salva', errors: fieldErrors(parsed.error) });
		let image = item.image;
		try {
			const uploaded = await saveImage(form.get('image'));
			if (uploaded) image = uploaded;
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { action: 'salva', errors: { image: e.message } as Record<string, string> });
			throw e;
		}
		if (form.get('removeImage') === 'on') image = null;
		await updateItem(item.id, parsed.data, image);
		if (image !== item.image) await deleteImage(item.image);
		await audit({ actorUserId: user.id, action: 'item.update', targetType: 'item', targetId: item.id, details: { nome: parsed.data.name, prezzo: parsed.data.price }, ip: clientIp(event) });
		return { action: 'salva', success: 'Oggetto salvato.' };
	},

	archivia: async (event) => {
		const { user } = requireCapability(event, 'items.manage');
		const item = await itemOr404(event);
		await updateItem(item.id, { archived: !item.archived });
		await audit({ actorUserId: user.id, action: 'item.update', targetType: 'item', targetId: item.id, details: { nome: item.name, archiviato: !item.archived }, ip: clientIp(event) });
		return { action: 'archivia', success: item.archived ? 'Oggetto ripristinato.' : 'Oggetto archiviato: non si vende né si consegna più.' };
	},

	elimina: async (event) => {
		const { user } = requireCapability(event, 'items.manage');
		const item = await itemOr404(event);
		// Si elimina solo ciò che nessuno possiede: altrimenti si archivia.
		if ((await ownedCount(item.id)) > 0) return fail(400, { action: 'elimina', error: 'Qualcuno possiede ancora questo oggetto: archivialo invece di eliminarlo.' });
		await deleteItem(item.id);
		await deleteImage(item.image);
		await audit({ actorUserId: user.id, action: 'item.delete', targetType: 'item', targetId: item.id, details: { nome: item.name }, ip: clientIp(event) });
		redirect(303, '/gestione/oggetti');
	},

	consegna: async (event) => {
		const { user } = requireCapability(event, 'items.manage');
		const item = await itemOr404(event);
		const form = await event.request.formData();
		const quantity = Number(form.get('quantity') ?? 1);
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return fail(400, { action: 'consegna', error: 'Quantità non valida (da 1 a 100).' });
		const target = await findCharacterByName(String(form.get('to') ?? ''));
		if (!target) return fail(400, { action: 'consegna', error: 'Personaggio non trovato.' });
		// Come per i PX: nessuno consegna oggetti ai propri personaggi.
		if (target.userId === user.id) return fail(403, { action: 'consegna', error: 'Non puoi consegnare oggetti ai tuoi personaggi.' });
		try {
			await giveItem(target.id, item.id, quantity);
		} catch (e) {
			if (e instanceof ItemError) return fail(400, { action: 'consegna', error: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'item.give', targetType: 'character', targetId: target.id, details: { personaggio: target.name, oggetto: item.name, quantita: quantity }, ip: clientIp(event) });
		return { action: 'consegna', success: `${item.name} consegnato a ${target.name}.` };
	}
};
