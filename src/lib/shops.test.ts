import { describe, expect, it } from 'vitest';
import { readShopForm } from './shops.ts';

const form = (o: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(o)) f.set(k, v);
	return f;
};

describe('readShopForm', () => {
	it('legge un negozio valido', () => {
		const r = readShopForm(form({ name: ' Arsenale ', tagline: 'Armi e munizioni', description: '', icon: 'pistol', sortOrder: '3', isOpen: 'on' }));
		expect(r.success && r.data).toEqual({ name: 'Arsenale', tagline: 'Armi e munizioni', description: '', icon: 'pistol', sortOrder: 3, isOpen: true });
	});
	it('rifiuta icone sconosciute e nomi troppo corti', () => {
		expect(readShopForm(form({ name: 'Arsenale', icon: 'x' })).success).toBe(false);
		expect(readShopForm(form({ name: 'A' })).success).toBe(false);
	});
});
