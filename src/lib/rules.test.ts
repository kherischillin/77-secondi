import { describe, expect, it } from 'vitest';
import {
	DEFAULT_RULES,
	computeCheck,
	describeCheck,
	pointsUsed,
	skillRaiseCost,
	statRaiseCost,
	validateAllocation,
	xpAvailable,
	type SkillDef,
	type StatDef
} from './rules';

const stats: StatDef[] = [
	{ id: 1, name: 'Forza', minValue: 1, maxValue: 10 },
	{ id: 2, name: 'Destrezza', minValue: 1, maxValue: 10 }
];
const skills: SkillDef[] = [
	{ id: 10, name: 'Spada', statId: 1, maxRank: 5 },
	{ id: 11, name: 'Scassinare', statId: 2, maxRank: 2 }
];
const rules = { ...DEFAULT_RULES, creationStatPoints: 8, creationSkillPoints: 4, creationSkillCap: 3 };

describe('distribuzione iniziale', () => {
	it('conta i punti sopra il minimo', () => {
		expect(pointsUsed(stats, skills, { stats: { 1: 5, 2: 3 }, skills: { 10: 2 } })).toEqual({
			statPoints: 6,
			skillPoints: 2
		});
	});

	it('accetta una distribuzione valida', () => {
		expect(validateAllocation(stats, skills, { stats: { 1: 6, 2: 4 }, skills: { 10: 3, 11: 1 } }, rules)).toEqual([]);
	});

	it('rifiuta troppi punti', () => {
		const errors = validateAllocation(stats, skills, { stats: { 1: 9, 2: 9 }, skills: {} }, rules);
		expect(errors.join(' ')).toMatch(/16 punti caratteristica su 8/);
	});

	it('rifiuta valori fuori dai limiti', () => {
		expect(validateAllocation(stats, skills, { stats: { 1: 0 }, skills: {} }, rules).length).toBe(1);
		expect(validateAllocation(stats, skills, { stats: { 1: 11 }, skills: {} }, rules).length).toBeGreaterThan(0);
	});

	it('applica il tetto più basso tra abilità e creazione', () => {
		// Scassinare ha massimo 2, anche se alla creazione si arriverebbe a 3.
		const errors = validateAllocation(stats, skills, { stats: {}, skills: { 11: 3 } }, rules);
		expect(errors.join(' ')).toMatch(/Scassinare.*tra 0 e 2/);
	});
});

describe('avanzamento', () => {
	it('il costo cresce con il livello', () => {
		expect(skillRaiseCost(0, DEFAULT_RULES)).toBe(10);
		expect(skillRaiseCost(2, DEFAULT_RULES)).toBe(30);
		expect(statRaiseCost(5, DEFAULT_RULES)).toBe(150);
	});

	it('calcola i PX disponibili', () => {
		expect(xpAvailable(100, 35)).toBe(65);
	});
});

describe('prove', () => {
	it('somma dado, caratteristica e rango', () => {
		const c = computeCheck({ die: 20, roll: 12, stat: { name: 'Destrezza', value: 6 }, skill: { name: 'Scassinare', rank: 2 } });
		expect(c.total).toBe(20);
		expect(c.natural).toBeNull();
		expect(describeCheck(c)).toBe('Scassinare (Destrezza 6 + rango 2) d20: 12 = 20');
	});

	it('prova su sola caratteristica', () => {
		const c = computeCheck({ die: 20, roll: 20, stat: { name: 'Forza', value: 4 }, skill: null });
		expect(c.total).toBe(24);
		expect(c.natural).toBe('max');
		expect(describeCheck(c)).toBe('Forza (valore 4) d20: 20 = 24');
	});

	it('abilità senza caratteristica collegata', () => {
		const c = computeCheck({ die: 20, roll: 1, stat: null, skill: { name: 'Fortuna', rank: 3 } });
		expect(c.total).toBe(4);
		expect(c.natural).toBe('min');
	});
});
