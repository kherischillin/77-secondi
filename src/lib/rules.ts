/**
 * Regole numeriche del gioco (usate solo nelle quest: il gioco libero è descrittivo).
 * Solo calcoli, niente database: così si possono testare e mostrare anche nel browser.
 */
import { z } from 'zod';

export const rulesSchema = z.object({
	/** Punti da distribuire sulle caratteristiche quando si crea il personaggio. */
	creationStatPoints: z.number().int().min(0).max(200),
	/** Ranghi di abilità da distribuire alla creazione. */
	creationSkillPoints: z.number().int().min(0).max(200),
	/** Rango massimo di un'abilità alla creazione. */
	creationSkillCap: z.number().int().min(0).max(50),
	/** Costo in PX per alzare un'abilità: questo valore × il nuovo rango. */
	skillRankCost: z.number().int().min(1).max(10000),
	/** Costo in PX per alzare una caratteristica: questo valore × il nuovo valore. */
	statPointCost: z.number().int().min(1).max(10000),
	/** Facce del dado delle prove in quest (es. 20 per un d20). */
	questDie: z.number().int().min(2).max(1000),
	/** Se falso, fuori dalle quest i tiri di dado (#2d6) sono disattivati: il gioco libero è descrittivo. */
	diceOutsideQuest: z.boolean(),
	/** Se falso, il background è visibile solo al proprietario e allo staff ("in scuro"). */
	backgroundPublic: z.boolean()
});

export type Rules = z.infer<typeof rulesSchema>;

export const DEFAULT_RULES: Rules = {
	creationStatPoints: 12,
	creationSkillPoints: 6,
	creationSkillCap: 3,
	skillRankCost: 10,
	statPointCost: 25,
	questDie: 20,
	diceOutsideQuest: false,
	backgroundPublic: true
};

export type StatDef = { id: number; name: string; minValue: number; maxValue: number };
export type SkillDef = { id: number; name: string; statId: number | null; maxRank: number };

// ---------------------------------------------------------------------------
// Distribuzione iniziale
// ---------------------------------------------------------------------------

export type Allocation = { stats: Record<number, number>; skills: Record<number, number> };

export function pointsUsed(stats: StatDef[], skills: SkillDef[], alloc: Allocation) {
	const statPoints = stats.reduce((sum, s) => sum + ((alloc.stats[s.id] ?? s.minValue) - s.minValue), 0);
	const skillPoints = skills.reduce((sum, s) => sum + (alloc.skills[s.id] ?? 0), 0);
	return { statPoints, skillPoints };
}

/** Controlla la distribuzione iniziale dei punti. Restituisce l'elenco degli errori (vuoto se va bene). */
export function validateAllocation(stats: StatDef[], skills: SkillDef[], alloc: Allocation, rules: Rules): string[] {
	const errors: string[] = [];
	for (const s of stats) {
		const v = alloc.stats[s.id] ?? s.minValue;
		if (!Number.isInteger(v) || v < s.minValue || v > s.maxValue) {
			errors.push(`${s.name}: il valore deve essere tra ${s.minValue} e ${s.maxValue}.`);
		}
	}
	for (const s of skills) {
		const r = alloc.skills[s.id] ?? 0;
		const cap = Math.min(s.maxRank, rules.creationSkillCap);
		if (!Number.isInteger(r) || r < 0 || r > cap) {
			errors.push(`${s.name}: alla creazione il rango deve essere tra 0 e ${cap}.`);
		}
	}
	const used = pointsUsed(stats, skills, alloc);
	if (used.statPoints > rules.creationStatPoints) {
		errors.push(`Hai usato ${used.statPoints} punti caratteristica su ${rules.creationStatPoints} disponibili.`);
	}
	if (used.skillPoints > rules.creationSkillPoints) {
		errors.push(`Hai usato ${used.skillPoints} ranghi di abilità su ${rules.creationSkillPoints} disponibili.`);
	}
	return errors;
}

// ---------------------------------------------------------------------------
// Avanzamento con i punti esperienza
// ---------------------------------------------------------------------------

export function skillRaiseCost(currentRank: number, rules: Rules): number {
	return (currentRank + 1) * rules.skillRankCost;
}

export function statRaiseCost(currentValue: number, rules: Rules): number {
	return (currentValue + 1) * rules.statPointCost;
}

export function xpAvailable(totalAwarded: number, spent: number): number {
	return totalAwarded - spent;
}

// ---------------------------------------------------------------------------
// Prove in quest
// ---------------------------------------------------------------------------

export type CheckInput = {
	die: number;
	roll: number;
	stat: { name: string; value: number } | null;
	skill: { name: string; rank: number } | null;
};

export type CheckResult = {
	die: number;
	roll: number;
	stat: { name: string; value: number } | null;
	skill: { name: string; rank: number } | null;
	total: number;
	/** Esito naturale del dado: massimo o minimo possibile. */
	natural: 'max' | 'min' | null;
};

export function computeCheck(input: CheckInput): CheckResult {
	const total = input.roll + (input.stat?.value ?? 0) + (input.skill?.rank ?? 0);
	return {
		...input,
		total,
		natural: input.roll === input.die ? 'max' : input.roll === 1 ? 'min' : null
	};
}

/** Testo leggibile di una prova, es. "Scassinare (Destrezza 6 + rango 2) d20: 14 = 22". */
export function describeCheck(c: CheckResult): string {
	const label = c.skill?.name ?? c.stat?.name ?? 'Prova';
	const parts: string[] = [];
	if (c.skill && c.stat) parts.push(`${c.stat.name} ${c.stat.value}`);
	if (!c.skill && c.stat) parts.push(`valore ${c.stat.value}`);
	if (c.skill) parts.push(`rango ${c.skill.rank}`);
	return `${label} (${parts.join(' + ')}) d${c.die}: ${c.roll} = ${c.total}`;
}
