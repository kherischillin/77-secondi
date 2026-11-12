import { describe, expect, it } from 'vitest';
import { gdrcdSkillCost, mysqlDate, slotFrom, usernameFrom } from './gdrcd.ts';

describe('importazione da GDRCD: conversioni', () => {
	it('date MySQL in ora italiana (con ora legale)', () => {
		expect(mysqlDate('2024-01-15 10:00:00')?.toISOString()).toBe('2024-01-15T09:00:00.000Z');
		expect(mysqlDate('2024-07-15 10:00:00')?.toISOString()).toBe('2024-07-15T08:00:00.000Z');
		expect(mysqlDate('2009-07-01')?.toISOString()).toBe('2009-06-30T22:00:00.000Z');
		expect(mysqlDate('0000-00-00 00:00:00')).toBeNull();
		expect(mysqlDate(null)).toBeNull();
	});
	it('nomi utente validi e unici', () => {
		const taken = new Set(['selene']);
		expect(usernameFrom('Selene', taken)).toBe('Selene2');
		expect(usernameFrom('Niccolò dei Medici', taken)).toBe('Niccolo_dei_Medici');
		expect(usernameFrom('Ö', taken)).toBe('O_pg');
		expect(usernameFrom('Selene', taken)).toBe('Selene3');
	});
	it('posizioni degli oggetti', () => {
		expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(slotFrom)).toEqual(['none', 'none', 'weapon', 'weapon', 'body', 'legs', 'feet', 'head', 'accessory', 'accessory']);
	});
	it('PX spesi come in GDRCD', () => {
		// grado 3 = 10+20+30, grado 1 = 10
		expect(gdrcdSkillCost([3, 1], 10)).toBe(70);
		expect(gdrcdSkillCost([], 10)).toBe(0);
	});
});
