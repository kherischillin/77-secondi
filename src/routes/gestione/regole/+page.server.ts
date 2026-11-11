import { fail } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { getRules, updateRules } from '#lib/server/settings.ts';
import { listSkills, listStats } from '#lib/server/sheet.ts';
import { rulesSchema } from '#lib/rules.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'rules.manage');
	const [rules, stats, skills] = await Promise.all([getRules(), listStats(), listSkills()]);
	return { rules, stats, skills };
};

const name = z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(40, 'Nome troppo lungo.');
const description = z.string().trim().max(500, 'Descrizione troppo lunga.');
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const statSchema = z
	.object({ name, description, minValue: int(0, 100), maxValue: int(1, 100), sortOrder: int(-1000, 1000) })
	.refine((s) => s.maxValue > s.minValue, { message: 'Il massimo deve essere maggiore del valore di partenza.' });

const skillSchema = z.object({
	name,
	description,
	statId: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().positive().nullable()),
	maxRank: int(1, 100),
	sortOrder: int(-1000, 1000)
});

function readStat(form: FormData) {
	return statSchema.safeParse({
		name: String(form.get('name') ?? ''),
		description: String(form.get('description') ?? ''),
		minValue: form.get('minValue'),
		maxValue: form.get('maxValue'),
		sortOrder: form.get('sortOrder') || 0
	});
}

function readSkill(form: FormData) {
	return skillSchema.safeParse({
		name: String(form.get('name') ?? ''),
		description: String(form.get('description') ?? ''),
		statId: form.get('statId'),
		maxRank: form.get('maxRank'),
		sortOrder: form.get('sortOrder') || 0
	});
}

function readId(form: FormData) {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	impostazioni: async (event) => {
		const { user } = requireCapability(event, 'rules.manage');
		const form = await event.request.formData();
		const num = (k: string) => Number(form.get(k));
		const parsed = rulesSchema.safeParse({
			creationStatPoints: num('creationStatPoints'),
			creationSkillPoints: num('creationSkillPoints'),
			creationSkillCap: num('creationSkillCap'),
			skillRankCost: num('skillRankCost'),
			statPointCost: num('statPointCost'),
			questDie: num('questDie'),
			diceOutsideQuest: form.get('diceOutsideQuest') === 'on',
			backgroundPublic: form.get('backgroundPublic') === 'on'
		});
		if (!parsed.success) return fail(400, { section: 'impostazioni', error: 'Controlla i valori: devono essere numeri interi positivi.' });
		await updateRules(parsed.data);
		await audit({ actorUserId: user.id, action: 'rules.update', details: parsed.data, ip: clientIp(event) });
		return { section: 'impostazioni', success: 'Regole salvate.' };
	},

	nuovaCaratteristica: async (event) => {
		const { user } = requireCapability(event, 'rules.manage');
		const parsed = readStat(await event.request.formData());
		if (!parsed.success) return fail(400, { section: 'stats', error: parsed.error.issues[0].message });
		const [stat] = await db.insert(schema.stats).values(parsed.data).returning();
		await audit({ actorUserId: user.id, action: 'stat.create', targetType: 'stat', targetId: stat.id, details: { nome: stat.name }, ip: clientIp(event) });
		return { section: 'stats', success: `Caratteristica «${stat.name}» creata.` };
	},

	modificaCaratteristica: async (event) => {
		const { user } = requireCapability(event, 'rules.manage');
		const form = await event.request.formData();
		const id = readId(form);
		const parsed = readStat(form);
		if (!id || !parsed.success) return fail(400, { section: 'stats', error: parsed.success ? 'Caratteristica non valida.' : parsed.error.issues[0].message });
		await db.transaction(async (tx) => {
			await tx.update(schema.stats).set(parsed.data).where(eq(schema.stats.id, id));
			// I valori dei personaggi restano dentro i nuovi limiti.
			await tx
				.update(schema.characterStats)
				.set({ value: sql`least(greatest(${schema.characterStats.value}, ${parsed.data.minValue}), ${parsed.data.maxValue})` })
				.where(eq(schema.characterStats.statId, id));
		});
		await audit({ actorUserId: user.id, action: 'stat.update', targetType: 'stat', targetId: id, details: parsed.data, ip: clientIp(event) });
		return { section: 'stats', success: `Caratteristica «${parsed.data.name}» salvata.` };
	},

	eliminaCaratteristica: async (event) => {
		const { user } = requireCapability(event, 'rules.manage');
		const id = readId(await event.request.formData());
		if (!id) return fail(400, { section: 'stats', error: 'Caratteristica non valida.' });
		const [stat] = await db.delete(schema.stats).where(eq(schema.stats.id, id)).returning();
		if (stat) await audit({ actorUserId: user.id, action: 'stat.delete', targetType: 'stat', targetId: id, details: { nome: stat.name }, ip: clientIp(event) });
		return { section: 'stats', success: 'Caratteristica eliminata.' };
	},

	nuovaAbilita: async (event) => {
		const { user } = requireCapability(event, 'rules.manage');
		const parsed = readSkill(await event.request.formData());
		if (!parsed.success) return fail(400, { section: 'skills', error: parsed.error.issues[0].message });
		const [skill] = await db.insert(schema.skills).values(parsed.data).returning();
		await audit({ actorUserId: user.id, action: 'skill.create', targetType: 'skill', targetId: skill.id, details: { nome: skill.name }, ip: clientIp(event) });
		return { section: 'skills', success: `Abilità «${skill.name}» creata.` };
	},

	modificaAbilita: async (event) => {
		const { user } = requireCapability(event, 'rules.manage');
		const form = await event.request.formData();
		const id = readId(form);
		const parsed = readSkill(form);
		if (!id || !parsed.success) return fail(400, { section: 'skills', error: parsed.success ? 'Abilità non valida.' : parsed.error.issues[0].message });
		await db.transaction(async (tx) => {
			await tx.update(schema.skills).set(parsed.data).where(eq(schema.skills.id, id));
			await tx
				.update(schema.characterSkills)
				.set({ rank: sql`least(${schema.characterSkills.rank}, ${parsed.data.maxRank})` })
				.where(eq(schema.characterSkills.skillId, id));
		});
		await audit({ actorUserId: user.id, action: 'skill.update', targetType: 'skill', targetId: id, details: parsed.data, ip: clientIp(event) });
		return { section: 'skills', success: `Abilità «${parsed.data.name}» salvata.` };
	},

	eliminaAbilita: async (event) => {
		const { user } = requireCapability(event, 'rules.manage');
		const id = readId(await event.request.formData());
		if (!id) return fail(400, { section: 'skills', error: 'Abilità non valida.' });
		const [skill] = await db.delete(schema.skills).where(eq(schema.skills.id, id)).returning();
		if (skill) await audit({ actorUserId: user.id, action: 'skill.delete', targetType: 'skill', targetId: id, details: { nome: skill.name }, ip: clientIp(event) });
		return { section: 'skills', success: 'Abilità eliminata.' };
	}
};
