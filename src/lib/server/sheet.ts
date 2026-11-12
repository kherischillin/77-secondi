import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { equippedBonus } from '../economy.ts';
import { db, schema } from './db/index.ts';
import {
	skillRaiseCost,
	statRaiseCost,
	validateAllocation,
	xpAvailable,
	type Allocation,
	type Rules
} from '../rules.ts';
import { mediaUrl } from './uploads.ts';

export async function listStats() {
	return db.select().from(schema.stats).orderBy(asc(schema.stats.sortOrder), asc(schema.stats.name));
}

export async function listSkills() {
	return db.select().from(schema.skills).orderBy(asc(schema.skills.sortOrder), asc(schema.skills.name));
}

export class SheetError extends Error {}

export async function getCharacter(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [c] = await db.select().from(schema.characters).where(eq(schema.characters.id, id));
	return c ?? null;
}

async function totalXp(characterId: number, tx: Pick<typeof db, 'select'> = db) {
	const [{ total }] = await tx
		.select({ total: sql<number>`coalesce(sum(${schema.xpAwards.amount}), 0)::int` })
		.from(schema.xpAwards)
		.where(eq(schema.xpAwards.characterId, characterId));
	return total;
}

/** Tutto ciò che serve a mostrare la scheda. */
export async function loadSheet(characterId: number) {
	const character = await getCharacter(characterId);
	if (!character || character.deletedAt) return null;

	const [stats, skills, statRows, skillRows, xpTotal, history] = await Promise.all([
		listStats(),
		listSkills(),
		db.select().from(schema.characterStats).where(eq(schema.characterStats.characterId, characterId)),
		db.select().from(schema.characterSkills).where(eq(schema.characterSkills.characterId, characterId)),
		totalXp(characterId),
		db
			.select({
				id: schema.xpAwards.id,
				amount: schema.xpAwards.amount,
				reason: schema.xpAwards.reason,
				createdAt: schema.xpAwards.createdAt,
				questTitle: schema.quests.title
			})
			.from(schema.xpAwards)
			.leftJoin(schema.quests, eq(schema.xpAwards.questId, schema.quests.id))
			.where(eq(schema.xpAwards.characterId, characterId))
			.orderBy(desc(schema.xpAwards.id))
			.limit(50)
	]);

	const statValue = new Map(statRows.map((r) => [r.statId, r.value]));
	const skillRank = new Map(skillRows.map((r) => [r.skillId, r.rank]));

	return {
		character: {
			id: character.id,
			userId: character.userId,
			name: character.name,
			surname: character.surname,
			bio: character.bio,
			appearance: character.appearance,
			personality: character.personality,
			background: character.background,
			portraitUrl: mediaUrl(character.portrait),
			portraitCredit: character.portraitCredit,
			statsAllocated: character.statsAllocated,
			createdAt: character.createdAt.toISOString()
		},
		stats: stats.map((s) => ({
			id: s.id,
			name: s.name,
			description: s.description,
			minValue: s.minValue,
			maxValue: s.maxValue,
			value: statValue.get(s.id) ?? s.minValue
		})),
		skills: skills.map((s) => ({
			id: s.id,
			name: s.name,
			description: s.description,
			statId: s.statId,
			maxRank: s.maxRank,
			rank: skillRank.get(s.id) ?? 0
		})),
		xp: { total: xpTotal, spent: character.xpSpent, available: xpAvailable(xpTotal, character.xpSpent) },
		history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))
	};
}

/** Distribuzione iniziale dei punti: si fa una volta sola. */
export async function saveAllocation(characterId: number, alloc: Allocation, rules: Rules) {
	const [stats, skills] = await Promise.all([listStats(), listSkills()]);
	const errors = validateAllocation(stats, skills, alloc, rules);
	if (errors.length) throw new SheetError(errors.join(' '));

	await db.transaction(async (tx) => {
		const [c] = await tx
			.select({ allocated: schema.characters.statsAllocated })
			.from(schema.characters)
			.where(eq(schema.characters.id, characterId))
			.for('update');
		if (!c) throw new SheetError('Personaggio non trovato.');
		if (c.allocated) throw new SheetError('I punti iniziali sono già stati distribuiti.');

		await tx.delete(schema.characterStats).where(eq(schema.characterStats.characterId, characterId));
		await tx.delete(schema.characterSkills).where(eq(schema.characterSkills.characterId, characterId));
		if (stats.length) {
			await tx
				.insert(schema.characterStats)
				.values(stats.map((s) => ({ characterId, statId: s.id, value: alloc.stats[s.id] ?? s.minValue })));
		}
		const ranked = skills.filter((s) => (alloc.skills[s.id] ?? 0) > 0);
		if (ranked.length) {
			await tx
				.insert(schema.characterSkills)
				.values(ranked.map((s) => ({ characterId, skillId: s.id, rank: alloc.skills[s.id] })));
		}
		await tx.update(schema.characters).set({ statsAllocated: true }).where(eq(schema.characters.id, characterId));
	});
}

/** Spende PX per alzare di 1 un'abilità o una caratteristica. */
export async function raise(characterId: number, target: { skillId: number } | { statId: number }, rules: Rules) {
	return db.transaction(async (tx) => {
		const [c] = await tx
			.select()
			.from(schema.characters)
			.where(eq(schema.characters.id, characterId))
			.for('update');
		if (!c) throw new SheetError('Personaggio non trovato.');
		if (!c.statsAllocated) throw new SheetError('Prima distribuisci i punti iniziali.');
		const available = xpAvailable(await totalXp(characterId, tx), c.xpSpent);

		let cost: number;
		let label: string;
		if ('skillId' in target) {
			const [skill] = await tx.select().from(schema.skills).where(eq(schema.skills.id, target.skillId));
			if (!skill) throw new SheetError('Abilità non trovata.');
			const [row] = await tx
				.select()
				.from(schema.characterSkills)
				.where(and(eq(schema.characterSkills.characterId, characterId), eq(schema.characterSkills.skillId, skill.id)));
			const current = row?.rank ?? 0;
			if (current >= skill.maxRank) throw new SheetError(`${skill.name} è già al massimo.`);
			cost = skillRaiseCost(current, rules);
			if (cost > available) throw new SheetError(`Servono ${cost} PX, ne hai ${available}.`);
			await tx
				.insert(schema.characterSkills)
				.values({ characterId, skillId: skill.id, rank: current + 1 })
				.onConflictDoUpdate({
					target: [schema.characterSkills.characterId, schema.characterSkills.skillId],
					set: { rank: current + 1 }
				});
			label = `${skill.name} ${current} → ${current + 1}`;
		} else {
			const [stat] = await tx.select().from(schema.stats).where(eq(schema.stats.id, target.statId));
			if (!stat) throw new SheetError('Caratteristica non trovata.');
			const [row] = await tx
				.select()
				.from(schema.characterStats)
				.where(and(eq(schema.characterStats.characterId, characterId), eq(schema.characterStats.statId, stat.id)));
			const current = row?.value ?? stat.minValue;
			if (current >= stat.maxValue) throw new SheetError(`${stat.name} è già al massimo.`);
			cost = statRaiseCost(current, rules);
			if (cost > available) throw new SheetError(`Servono ${cost} PX, ne hai ${available}.`);
			await tx
				.insert(schema.characterStats)
				.values({ characterId, statId: stat.id, value: current + 1 })
				.onConflictDoUpdate({
					target: [schema.characterStats.characterId, schema.characterStats.statId],
					set: { value: current + 1 }
				});
			label = `${stat.name} ${current} → ${current + 1}`;
		}

		await tx
			.update(schema.characters)
			.set({ xpSpent: c.xpSpent + cost })
			.where(eq(schema.characters.id, characterId));
		return { cost, label };
	});
}

/** Assegna (o toglie, con un valore negativo) PX a uno o più personaggi. */
export async function awardXp(
	characterIds: number[],
	amount: number,
	reason: string,
	awardedByUserId: number,
	questId: number | null = null
) {
	if (!characterIds.length) return;
	await db.insert(schema.xpAwards).values(
		characterIds.map((characterId) => ({ characterId, amount, reason, awardedByUserId, questId }))
	);
}

/** Staff: imposta direttamente i valori (correzioni), senza spendere PX. */
export async function staffSetValues(characterId: number, values: Allocation) {
	const [stats, skills] = await Promise.all([listStats(), listSkills()]);
	for (const s of stats) {
		const v = values.stats[s.id];
		if (v !== undefined && (!Number.isInteger(v) || v < s.minValue || v > s.maxValue)) {
			throw new SheetError(`${s.name}: il valore deve essere tra ${s.minValue} e ${s.maxValue}.`);
		}
	}
	for (const s of skills) {
		const r = values.skills[s.id];
		if (r !== undefined && (!Number.isInteger(r) || r < 0 || r > s.maxRank)) {
			throw new SheetError(`${s.name}: il rango deve essere tra 0 e ${s.maxRank}.`);
		}
	}
	await db.transaction(async (tx) => {
		for (const s of stats) {
			const value = values.stats[s.id];
			if (value === undefined) continue;
			await tx
				.insert(schema.characterStats)
				.values({ characterId, statId: s.id, value })
				.onConflictDoUpdate({ target: [schema.characterStats.characterId, schema.characterStats.statId], set: { value } });
		}
		for (const s of skills) {
			const rank = values.skills[s.id];
			if (rank === undefined) continue;
			await tx
				.insert(schema.characterSkills)
				.values({ characterId, skillId: s.id, rank })
				.onConflictDoUpdate({ target: [schema.characterSkills.characterId, schema.characterSkills.skillId], set: { rank } });
		}
		await tx.update(schema.characters).set({ statsAllocated: true }).where(eq(schema.characters.id, characterId));
	});
}

/** Staff: permette al giocatore di rifare la distribuzione iniziale. */
export async function resetAllocation(characterId: number) {
	await db.transaction(async (tx) => {
		await tx.delete(schema.characterStats).where(eq(schema.characterStats.characterId, characterId));
		await tx.delete(schema.characterSkills).where(eq(schema.characterSkills.characterId, characterId));
		await tx
			.update(schema.characters)
			.set({ statsAllocated: false, xpSpent: 0 })
			.where(eq(schema.characters.id, characterId));
	});
}

/** Valori usati in una prova: caratteristica e rango dell'abilità scelta. */
/** Oggetti equipaggiati con i loro bonus (per le prove in quest). */
async function equippedItems(characterId: number) {
	return db
		.select({ name: schema.items.name, bonuses: schema.items.bonuses })
		.from(schema.characterItems)
		.innerJoin(schema.items, eq(schema.characterItems.itemId, schema.items.id))
		.where(and(eq(schema.characterItems.characterId, characterId), eq(schema.characterItems.equipped, true)));
}

/** Valori per una prova: caratteristica, rango e bonus degli oggetti equipaggiati. */
export async function checkValues(characterId: number, target: { skillId: number } | { statId: number }) {
	const equipped = await equippedItems(characterId);
	if ('skillId' in target) {
		const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.id, target.skillId));
		if (!skill) return null;
		const [rankRow] = await db
			.select()
			.from(schema.characterSkills)
			.where(and(eq(schema.characterSkills.characterId, characterId), eq(schema.characterSkills.skillId, skill.id)));
		let stat: { name: string; value: number } | null = null;
		if (skill.statId) {
			const [s] = await db.select().from(schema.stats).where(eq(schema.stats.id, skill.statId));
			const [v] = await db
				.select()
				.from(schema.characterStats)
				.where(and(eq(schema.characterStats.characterId, characterId), eq(schema.characterStats.statId, skill.statId)));
			if (s) stat = { name: s.name, value: v?.value ?? s.minValue };
		}
		const bonus = equippedBonus(equipped, { statId: skill.statId, skillId: skill.id });
		return { stat, skill: { name: skill.name, rank: rankRow?.rank ?? 0 }, bonus: bonus.value ? bonus : null };
	}
	const [s] = await db.select().from(schema.stats).where(eq(schema.stats.id, target.statId));
	if (!s) return null;
	const [v] = await db
		.select()
		.from(schema.characterStats)
		.where(and(eq(schema.characterStats.characterId, characterId), eq(schema.characterStats.statId, s.id)));
	const bonus = equippedBonus(equipped, { statId: s.id, skillId: null });
	return { stat: { name: s.name, value: v?.value ?? s.minValue }, skill: null, bonus: bonus.value ? bonus : null };
}

/** Nomi dei personaggi (per i moduli di assegnazione PX). */
export async function characterNames(ids: number[]) {
	if (!ids.length) return [];
	return db
		.select({ id: schema.characters.id, name: schema.characters.name, surname: schema.characters.surname })
		.from(schema.characters)
		.where(inArray(schema.characters.id, ids));
}
