import { describe, expect, it } from 'vitest';
import { splitInternalLinks } from './internal-links.ts';

describe('splitInternalLinks', () => {
	it('rende cliccabile solo il percorso di un luogo', () => {
		expect(splitInternalLinks('Entra da qui → /gioco/luogo/12 ciao')).toEqual([
			{ text: 'Entra da qui → ' },
			{ href: '/gioco/luogo/12', label: 'apri la chat' },
			{ text: ' ciao' }
		]);
	});
	it('ignora link esterni e percorsi diversi', () => {
		expect(splitInternalLinks('https://x.it/gioco/luogo/abc e /gioco/luogo/3/eventi')).toEqual([{ text: 'https://x.it/gioco/luogo/abc e /gioco/luogo/3/eventi' }]);
	});
	it('testo senza link resta com\'è', () => {
		expect(splitInternalLinks('ciao')).toEqual([{ text: 'ciao' }]);
	});
});
