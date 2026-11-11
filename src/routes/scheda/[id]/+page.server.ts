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
	raise,
	resetAllocation,
	saveAllocation,
	staffSetValues
} from '#lib/server/sheet.ts';
import { getRules } from '#lib/server/settings.ts';
import { skillRaiseCost, statRaiseCost, type Allocation } from '#lib/rules.ts';
import { audit } from '#lib/server/audit.ts';
import { listPublicForCharacter } from '#lib/server/giocate.ts';
import { fullName } from '#lib/format.ts';
import { membershipsOf } from '#lib/server/guilds.ts';

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
	const { userId: _hidden, ...character } = sheet.character;

	return {
		character: {
			...character,
			// Background "in scuro": visibile solo al proprietario e allo staff.
			background: rules.backgroundPublic || seesPrivate ? character.background : null,
			backgroundHidden: !rules.backgroundPublic && !seesPrivate && !!character.background
		},
		giocate: await listPublicForCharacter(character.id),
		guilds: guilds.map((g) => ({ id: g.guildId, name: g.guildName, rank: g.rankName, symbolUrl: g.symbolUrl })),
		stats: sheet.stats.map((s) => ({ ...s, raiseCost: statRaiseCost(s.value, rules) })),
		skills: sheet.skills.map((s) => ({ ...s, raiseCost: skillRaiseCost(s.rank, rules) })),
		xp: seesPrivate ? sheet.xp : null,
		history: seesPrivate ? sheet.history : [],
		rules: {
			creationStatPoints: rules.creationStatPoints,
			creationSkillPoints: rules.creationSkillPoints,
			creationSkillCap: rules.creationSkillCap,
			backgroundPublic: rules.backgroundPublic
		},
		viewer: { isOwner, isStaff, canAward, canEdit: isOwner || user.capabilities.has('characters.manage') }
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

async function staffOn(event: RequestEvent, capability: 'characters.manage' | 'xp.award') {
	const { user } = requireUser(event);
	if (!user.capabilities.has(capability)) error(403, 'Non hai i permessi per questa azione.');
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
	}
};
