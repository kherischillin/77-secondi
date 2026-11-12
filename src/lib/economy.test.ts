import { describe, expect, it } from 'vitest';
import {
	amountSchema,
	canEquip,
	equippedBonus,
	formatMoney,
	readBonuses,
	readItemForm,
	roomCost,
	salaryStatus,
	sellPrice,
	stacks
} from './economy.ts';
import { computeCheck, describeCheck } from './rules.ts';

describe('denaro', () => {
	it('formatta con i separatori italiani', () => {
		expect(formatMoney(1250, 'monete')).toBe('1.250 monete');
	});
	it('rivendita arrotondata per difetto', () => {
		expect(sellPrice(99, 50)).toBe(49);
		expect(sellPrice(100, 0)).toBe(0);
		expect(sellPrice(100, 100)).toBe(100);
	});
	it('importi: solo interi positivi', () => {
		expect(amountSchema.safeParse('10').success).toBe(true);
		expect(amountSchema.safeParse('0').success).toBe(false);
		expect(amountSchema.safeParse('-5').success).toBe(false);
		expect(amountSchema.safeParse('2.5').success).toBe(false);
		expect(amountSchema.safeParse('abc').success).toBe(false);
	});
	it('costo delle stanze', () => {
		expect(roomCost(15, 3)).toBe(45);
	});
});

describe('stipendio', () => {
	const now = new Date('2026-11-12T12:00:00Z');
	it('pronto la prima volta', () => {
		expect(salaryStatus(null, now, 24).ready).toBe(true);
	});
	it('non prima dell’intervallo', () => {
		const s = salaryStatus(new Date('2026-11-12T00:00:00Z'), now, 24);
		expect(s.ready).toBe(false);
		expect(s.nextAt?.toISOString()).toBe('2026-11-13T00:00:00.000Z');
	});
	it('pronto dopo l’intervallo', () => {
		expect(salaryStatus(new Date('2026-11-11T11:00:00Z'), now, 24).ready).toBe(true);
	});
});

describe('oggetti', () => {
	it('posizioni ed equipaggiamento', () => {
		expect(canEquip('none', 0).ok).toBe(false);
		expect(canEquip('head', 0).ok).toBe(true);
		expect(canEquip('head', 1).ok).toBe(false);
		expect(canEquip('weapon', 1).ok).toBe(true);
		expect(canEquip('weapon', 2).ok).toBe(false);
		expect(canEquip('ali', 0).ok).toBe(false);
	});
	it('solo gli oggetti da non indossare si accumulano', () => {
		expect(stacks('none')).toBe(true);
		expect(stacks('weapon')).toBe(false);
	});
	it('bonus: abilità e sua caratteristica, non altro', () => {
		const eq = [
			{ name: 'Grimaldelli', bonuses: [{ skillId: 7, value: 2 }] },
			{ name: 'Guanti agili', bonuses: [{ statId: 2, value: 1 }, { statId: 1, value: 3 }] },
			{ name: 'Elmo', bonuses: [{ statId: 3, value: 1 }] }
		];
		expect(equippedBonus(eq, { statId: 2, skillId: 7 })).toEqual({ value: 3, sources: ['Grimaldelli +2', 'Guanti agili +1'] });
		expect(equippedBonus(eq, { statId: 1, skillId: null })).toEqual({ value: 3, sources: ['Guanti agili +3'] });
		expect(equippedBonus(eq, { statId: 9, skillId: null })).toEqual({ value: 0, sources: [] });
	});
	it('malus negativi', () => {
		expect(equippedBonus([{ name: 'Armatura pesante', bonuses: [{ statId: 2, value: -2 }] }], { statId: 2, skillId: null }).value).toBe(-2);
	});
	it('lettura dei bonus dal modulo', () => {
		expect(readBonuses(['stat:2', 'skill:5', '', 'stat:x', 'stat:3'], ['1', '-2', '4', '1', '0'])).toEqual([
			{ statId: 2, value: 1 },
			{ skillId: 5, value: -2 }
		]);
	});
	it('modulo oggetto', () => {
		const fd = new FormData();
		fd.set('name', 'Medikit');
		fd.set('description', 'Cura le ferite leggere.');
		fd.set('category', 'Medicinali');
		fd.set('slot', 'none');
		fd.set('price', '30');
		fd.set('forSale', 'on');
		fd.set('stock', '');
		fd.set('consumable', 'on');
		const r = readItemForm(fd);
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.stock).toBeNull();
			expect(r.data.consumable).toBe(true);
			expect(r.data.sellable).toBe(false);
		}
		fd.set('slot', 'ali');
		expect(readItemForm(fd).success).toBe(false);
		fd.set('slot', 'none');
		fd.set('price', '-1');
		expect(readItemForm(fd).success).toBe(false);
	});
});

describe('prove con oggetti', () => {
	it('il bonus entra nel totale e nel testo', () => {
		const c = computeCheck({
			die: 20,
			roll: 10,
			stat: { name: 'Destrezza', value: 5 },
			skill: { name: 'Scassinare', rank: 2 },
			bonus: { value: 2, sources: ['Grimaldelli +2'] }
		});
		expect(c.total).toBe(19);
		expect(describeCheck(c)).toBe('Scassinare (Destrezza 5 + rango 2 + oggetti 2) d20: 10 = 19');
	});
	it('senza oggetti il testo non cambia', () => {
		const c = computeCheck({ die: 20, roll: 3, stat: { name: 'Forza', value: 4 }, skill: null, bonus: null });
		expect(describeCheck(c)).toBe('Forza (valore 4) d20: 3 = 7');
	});
});
