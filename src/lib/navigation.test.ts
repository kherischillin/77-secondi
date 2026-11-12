import { describe, expect, it } from 'vitest';
import { allowedWithoutCharacter } from './navigation.ts';

describe('pagine senza personaggio', () => {
	it('lascia aperte scelta, account, impostazioni e spazi dello staff', () => {
		for (const p of ['/', '/scegli-personaggio', '/account', '/temi', '/notifiche', '/gestione', '/gestione/utenti', '/master/esiti', '/pagine/guida']) {
			expect(allowedWithoutCharacter(p), p).toBe(true);
		}
	});
	it('il resto richiede un personaggio', () => {
		for (const p of ['/gioco', '/missive', '/bacheche', '/mercato', '/scheda/1', '/accountx', '/gestionex']) {
			expect(allowedWithoutCharacter(p), p).toBe(false);
		}
	});
});
