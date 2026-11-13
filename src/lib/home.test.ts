import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME, homeSchema, readNewsForm, sortNews } from './home.ts';

const form = (o: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(o)) f.set(k, v);
	return f;
};

describe('pagina iniziale', () => {
	it('i valori predefiniti sono validi', () => {
		expect(homeSchema.safeParse(DEFAULT_HOME).success).toBe(true);
	});

	it('legge una news con le caselle', () => {
		const r = readNewsForm(form({ title: '  Nuove gilde ', summary: 'Aperte le candidature', body: '', isPinned: 'on' }));
		expect(r.success && r.data).toEqual({ title: 'Nuove gilde', summary: 'Aperte le candidature', body: '', isPublished: false, isPinned: true });
	});

	it('rifiuta titoli troppo corti o righe troppo lunghe', () => {
		expect(readNewsForm(form({ title: 'Ok' })).success).toBe(false);
		expect(readNewsForm(form({ title: 'Titolo', summary: 'x'.repeat(161) })).success).toBe(false);
	});

	it('mette in cima quelle in evidenza, poi le più recenti', () => {
		const list = [
			{ id: 1, isPinned: false, createdAt: '2026-01-01' },
			{ id: 2, isPinned: true, createdAt: '2025-01-01' },
			{ id: 3, isPinned: false, createdAt: '2026-02-01' }
		];
		expect(sortNews(list).map((n) => n.id)).toEqual([2, 3, 1]);
	});
});
