import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireUser, clientIp } from '#lib/server/guards.ts';
import {
	SheetError,
	awardXp,
	getCharacter,
	listSkills,
	listStats,
	loadSheet,
	portraitSrc,
	raise,
	redoOwnAllocation,
	resetAllocation,
	saveAllocation,
	staffSetValues
} from '#lib/server/sheet.ts';
import { getRules } from '#lib/server/settings.ts';
import { requiredPoints, skillRaiseCost, statRaiseCost, type Allocation } from '#lib/rules.ts';
import { profileRows } from '#lib/profile.ts';
import { audit } from '#lib/server/audit.ts';
import { listPublicForCharacter } from '#lib/server/giocate.ts';
import { fullName } from '#lib/format.ts';
import { membershipsOf } from '#lib/server/guilds.ts';
import { confiscate, equippedOf, giveItem, inventory, ItemError, listCatalog } from '#lib/server/items.ts';
import { describeBonuses, isSlot, SLOT_LABELS } from '#lib/economy.ts';
import { renderSheetHtml } from '#lib/server/sheet-html.ts';

async function sheetOr404(id: string) {
	const sheet = await loadSheet(Number(id));
	if (!sheet) error(404, 'Personaggio non trovato.');
	return sheet;
}

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	const [sheet, rules, guilds] = await Promise.all([
		sheetOr404(event.params.id),
		getRules(),
		membershipsOf(Number(event.params.id))
	]);

	const isOwner = sheet.character.userId === user.id;
	const isStaff = user.capabilities.has('characters.manage') && !isOwner;
	const canAward = user.capabilities.has('xp.award') && !isOwner;
	const seesPrivate = isOwner || user.capabilities.has('characters.manage') || user.capabilities.has('xp.award');
	const canGive = (user.capabilities.has('items.give') || user.capabilities.has('items.manage')) && !isOwner;
	const canConfiscate = user.capabilities.has('items.manage') && !isOwner;
	const { userId: _hidden, portrait: _stored, profile: _profile, ...character } = sheet.character;
	const settings = event.locals.settings;
	const names = { stats: sheet.stats.map((s) => ({ id: s.id, name: s.name })), skills: sheet.skills.map((s) => ({ id: s.id, name: s.name })) };
	const [equipped, staffInventory, catalog] = await Promise.all([
		equippedOf(character.id),
		canConfiscate ? inventory(character.id) : Promise.resolve([]),
		canGive ? listCatalog() : Promise.resolve([])
	]);

	return {
		character: {
			...character,
			// Sezioni personalizzabili: HTML già pulito, da mostrare solo nel riquadro isolato.
			appearance: renderSheetHtml(character.appearance),
			personality: renderSheetHtml(character.personality),
			// Background "in scuro": visibile solo al proprietario e allo staff.
			background: rules.backgroundPublic || seesPrivate ? renderSheetHtml(character.background) : null,
			backgroundHidden: !rules.backgroundPublic && !seesPrivate && !!character.background,
			offGame: renderSheetHtml(character.offGame),
			portraitUrl: portraitSrc(sheet.character.portrait, settings.portraitHosts)
		},
		profile: profileRows(sheet.character.profile),
		portraitBox: { width: settings.portraitMaxWidth, height: settings.portraitMaxHeight },
		giocate: await listPublicForCharacter(character.id),
		// L'equipaggiamento è la parte "visibile" in gioco: lo vedono tutti.
		equipped: equipped.map((i) => ({
			id: i.id,
			name: i.name,
			description: i.description,
			imageUrl: i.imageUrl,
			slot: isSlot(i.slot) ? SLOT_LABELS[i.slot] : i.slot,
			bonus: describeBonuses(i.bonuses, names.stats, names.skills)
		})),
		staffInventory: staffInventory.map((i) => ({ id: i.id, name: i.item.name, quantity: i.quantity, equipped: i.equipped })),
		giveable: catalog.filter((i) => !i.archived).map((i) => ({ id: i.id, name: i.name })),
		guilds: guilds.map((g) => ({ id: g.guildId, name: g.guildName, rank: g.rankName, symbolUrl: g.symbolUrl })),
		stats: sheet.stats.map((s) => ({ ...s, raiseCost: statRaiseCost(s.value, rules) })),
		skills: sheet.skills.map((s) => ({ ...s, raiseCost: skillRaiseCost(s.rank, rules) })),
		xp: seesPrivate ? sheet.xp : null,
		history: seesPrivate ? sheet.history : [],
		rules: {
			creationStatPoints: rules.creationStatPoints,
			creationSkillPoints: rules.creationSkillPoints,
			creationSkillCap: rules.creationSkillCap,
			backgroundPublic: rules.backgroundPublic,
			required: requiredPoints(sheet.stats, sheet.skills, rules)
		},
		viewer: {
			// Rifare la distribuzione da soli: solo prima di ricevere o spendere PX.
			canRedo: isOwner && character.statsAllocated && sheet.xp.spent === 0 && sheet.history.length === 0,
			isOwner,
			isStaff,
			canAward,
			canGive,
			canConfiscate,
			canEdit: isOwner || user.capabilities.has('characters.manage')
		}
	};
};

/** Legge i campi stat_ID e skill_ID di un modulo. */
function readValues(form: FormData, statIds: number[], skillIds: number[]): Allocation {
	const read = (key: string) => {
		const v = form.get(key);
		return v === null || v === '' ? undefined : Number(v);
	};
	const stats: Record<number, number> = {};
	const skills: Record<number, number> = {};
	for (const id of statIds) {
		const v = read(`stat_${id}`);
		if (v !== undefined) stats[id] = v;
	}
	for (const id of skillIds) {
		const v = read(`skill_${id}`);
		if (v !== undefined) skills[id] = v;
	}
	return { stats, skills };
}

async function ownerOnly(event: RequestEvent) {
	const { user } = requireUser(event);
	const character = await getCharacter(Number(event.params.id));
	if (!character || character.deletedAt) error(404, 'Personaggio non trovato.');
	if (character.userId !== user.id) error(403, 'Puoi modificare solo i tuoi personaggi.');
	return { user, character };
}

async function staffOn(event: RequestEvent, capability: 'characters.manage' | 'xp.award' | 'items.give' | 'items.manage') {
	const { user } = requireUser(event);
	const allowed = user.capabilities.has(capability) || (capability === 'items.give' && user.capabilities.has('items.manage'));
	if (!allowed) error(403, 'Non hai i permessi per questa azione.');
	const character = await getCharacter(Number(event.params.id));
	if (!character || character.deletedAt) error(404, 'Personaggio non trovato.');
	// Nessuno si assegna PX o si corregge i valori da solo.
	if (character.userId === user.id) error(403, 'Non puoi usare gli strumenti dello staff sui tuoi personaggi.');
	return { user, character };
}

export const actions: Actions = {
	distribuisci: async (event) => {
		const { user, character } = await ownerOnly(event);
		const [stats, skills, rules] = await Promise.all([listStats(), listSkills(), getRules()]);
		const alloc = readValues(await event.request.formData(), stats.map((s) => s.id), skills.map((s) => s.id));
		try {
			await saveAllocation(character.id, alloc, rules);
		} catch (e) {
			if (e instanceof SheetError) return fail(400, { action: 'distribuisci', error: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'sheet.allocate', targetType: 'character', targetId: character.id, details: alloc, ip: clientIp(event) });
		return { action: 'distribuisci', success: 'Punti distribuiti. Da ora migliori il personaggio spendendo PX.' };
	},

	/** Il giocatore rifà la distribuzione finché non ha PX. */
	rifai: async (event) => {
		const { user, character } = await ownerOnly(event);
		try {
			await redoOwnAllocation(character.id);
		} catch (e) {
			if (e instanceof SheetError) return fail(400, { action: 'rifai', error: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'sheet.redo', targetType: 'character', targetId: character.id, details: { personaggio: fullName(character) }, ip: clientIp(event) });
		return { action: 'rifai', success: 'Distribuzione annullata: puoi rifarla qui sotto.' };
	},

	migliora: async (event) => {
		const { user, character } = await ownerOnly(event);
		const [type, rawId] = String((await event.request.formData()).get('target') ?? '').split(':');
		const id = Number(rawId);
		if (!Number.isInteger(id) || (type !== 'skill' && type !== 'stat')) return fail(400, { action: 'migliora', error: 'Scelta non valida.' });
		try {
			const result = await raise(character.id, type === 'skill' ? { skillId: id } : { statId: id }, await getRules());
			await audit({ actorUserId: user.id, action: 'sheet.raise', targetType: 'character', targetId: character.id, details: result, ip: clientIp(event) });
			return { action: 'migliora', success: `${result.label} (spesi ${result.cost} PX).` };
		} catch (e) {
			if (e instanceof SheetError) return fail(400, { action: 'migliora', error: e.message });
			throw e;
		}
	},

	assegnaPx: async (event) => {
		const { user, character } = await staffOn(event, 'xp.award');
		const form = await event.request.formData();
		const parsed = z
			.object({
				amount: z.coerce.number().int().min(-1000).max(1000).refine((n) => n !== 0, 'Indica un valore diverso da 0.'),
				reason: z.string().trim().min(3, 'Indica il motivo.').max(200)
			})
			.safeParse({ amount: form.get('amount'), reason: form.get('reason') });
		if (!parsed.success) return fail(400, { action: 'assegnaPx', error: parsed.error.issues[0].message });

		await awardXp([character.id], parsed.data.amount, parsed.data.reason, user.id);
		await audit({
			actorUserId: user.id,
			action: 'xp.award',
			targetType: 'character',
			targetId: character.id,
			details: { personaggio: fullName(character), ...parsed.data },
			ip: clientIp(event)
		});
		return { action: 'assegnaPx', success: `${parsed.data.amount > 0 ? 'Assegnati' : 'Tolti'} ${Math.abs(parsed.data.amount)} PX.` };
	},

	correggi: async (event) => {
		const { user, character } = await staffOn(event, 'characters.manage');
		const [stats, skills] = await Promise.all([listStats(), listSkills()]);
		const values = readValues(await event.request.formData(), stats.map((s) => s.id), skills.map((s) => s.id));
		try {
			await staffSetValues(character.id, values);
		} catch (e) {
			if (e instanceof SheetError) return fail(400, { action: 'correggi', error: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'sheet.staff_set', targetType: 'character', targetId: character.id, details: values, ip: clientIp(event) });
		return { action: 'correggi', success: 'Valori corretti.' };
	},

	azzera: async (event) => {
		const { user, character } = await staffOn(event, 'characters.manage');
		await resetAllocation(character.id);
		await audit({ actorUserId: user.id, action: 'sheet.reset', targetType: 'character', targetId: character.id, details: { personaggio: fullName(character) }, ip: clientIp(event) });
		return { action: 'azzera', success: 'Distribuzione azzerata: il giocatore può rifarla e i PX spesi gli sono stati restituiti.' };
	},

	/** Consegna di un oggetto (premio di quest, ritrovamento). */
	consegna: async (event) => {
		const { user, character } = await staffOn(event, 'items.give');
		if (character.userId === user.id) error(403, 'Non puoi consegnare oggetti ai tuoi personaggi.');
		const form = await event.request.formData();
		const quantity = Number(form.get('quantity') ?? 1);
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return fail(400, { action: 'consegna', error: 'Quantità non valida (da 1 a 100).' });
		try {
			const item = await giveItem(character.id, Number(form.get('itemId')), quantity);
			await audit({ actorUserId: user.id, action: 'item.give', targetType: 'character', targetId: character.id, details: { personaggio: character.name, oggetto: item.name, quantita: quantity }, ip: clientIp(event) });
			return { action: 'consegna', success: `${item.name} consegnato a ${character.name}.` };
		} catch (e) {
			if (e instanceof ItemError) return fail(400, { action: 'consegna', error: e.message });
			throw e;
		}
	},

	/** Lo staff toglie un oggetto (es. ottenuto in modo scorretto). */
	confisca: async (event) => {
		const { user, character } = await staffOn(event, 'items.manage');
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const own = (await inventory(character.id)).some((i) => i.id === id);
		if (!own) return fail(404, { action: 'confisca', error: 'Oggetto non trovato.' });
		const removed = await confiscate(id);
		await audit({ actorUserId: user.id, action: 'item.confiscate', targetType: 'character', targetId: character.id, details: { personaggio: character.name, oggetto: removed?.item?.name, quantita: removed?.row.quantity }, ip: clientIp(event) });
		return { action: 'confisca', success: 'Oggetto tolto.' };
	}
};
