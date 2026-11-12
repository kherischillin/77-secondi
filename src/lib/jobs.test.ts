import { describe, expect, it } from 'vitest';
import { readJobForm } from './jobs.ts';

const form = (o: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(o)) f.set(k, v);
	return f;
};

describe('readJobForm', () => {
	it('legge un lavoro valido', () => {
		const r = readJobForm(form({ name: ' Barista ', description: 'Dietro al bancone', pay: '45', sortOrder: '2', isOpen: 'on' }));
		expect(r.success && r.data).toEqual({ name: 'Barista', description: 'Dietro al bancone', pay: 45, icon: 'briefcase', sortOrder: 2, isOpen: true });
	});
	it('rifiuta paga negativa o non intera e nomi troppo corti', () => {
		expect(readJobForm(form({ name: 'Barista', pay: '-1' })).success).toBe(false);
		expect(readJobForm(form({ name: 'Barista', pay: '2.5' })).success).toBe(false);
		expect(readJobForm(form({ name: 'B', pay: '10' })).success).toBe(false);
	});
	it('accetta solo icone dell\'elenco', () => {
		const ok = readJobForm(form({ name: 'Barista', pay: '10', icon: 'cocktail' }));
		expect(ok.success && ok.data.icon).toBe('cocktail');
		expect(readJobForm(form({ name: 'Barista', pay: '10', icon: '<script>' })).success).toBe(false);
	});
	it('senza spunta il lavoro è chiuso', () => {
		const r = readJobForm(form({ name: 'Barista', pay: '10' }));
		expect(r.success && r.data.isOpen).toBe(false);
	});
});
