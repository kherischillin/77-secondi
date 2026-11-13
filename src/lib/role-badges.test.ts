import { describe, expect, it } from 'vitest';
import { roleBadges } from './role-badges.ts';

describe('roleBadges', () => {
	it('lavoro libero: icona senza collegamento', () => {
		expect(roleBadges({ name: 'Barista', icon: 'cocktail' })).toEqual([{ icon: 'cocktail', title: 'Barista', href: null }]);
	});
	it('gilda: icona con grado e collegamento alla pagina della gilda', () => {
		expect(roleBadges(null, [{ id: 3, name: 'Maelstrom', icon: 'skull', rank: 'Cromato' }])).toEqual([
			{ icon: 'skull', title: 'Cromato · Maelstrom', href: '/gilde/3' }
		]);
	});
	it('nessun ruolo: nessuna icona', () => {
		expect(roleBadges({ name: null, icon: null })).toEqual([]);
	});
});
