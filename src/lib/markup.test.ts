import { describe, expect, it } from 'vitest';
import { isSlug, renderMarkup, slugify } from './markup.ts';

describe('formattazione delle pagine', () => {
	it('titoli, paragrafi, grassetto e corsivo', () => {
		expect(renderMarkup('# Regole\n\nIl gioco è **descrittivo**, le quest *numeriche*.')).toBe(
			'<h2>Regole</h2>\n<p>Il gioco è <strong>descrittivo</strong>, le quest <em>numeriche</em>.</p>'
		);
	});
	it('a capo dentro un paragrafo', () => {
		expect(renderMarkup('riga uno\nriga due')).toBe('<p>riga uno<br>riga due</p>');
	});
	it('elenchi puntati e numerati', () => {
		expect(renderMarkup('- uno\n- due\n\n1. primo\n2. secondo')).toBe('<ul><li>uno</li><li>due</li></ul>\n<ol><li>primo</li><li>secondo</li></ol>');
	});
	it('citazioni e separatori', () => {
		expect(renderMarkup('> Le stringhe del Master sono vincolanti.\n\n---')).toBe('<blockquote>Le stringhe del Master sono vincolanti.</blockquote>\n<hr>');
	});
	it('link sicuri, interni ed esterni', () => {
		expect(renderMarkup('[Regolamento](/pagine/regolamento)')).toBe('<p><a href="/pagine/regolamento">Regolamento</a></p>');
		expect(renderMarkup('[Sito](https://example.com/?a=1&b=2)')).toBe(
			'<p><a href="https://example.com/?a=1&amp;b=2" rel="noopener noreferrer nofollow" target="_blank">Sito</a></p>'
		);
	});
	it('niente HTML né link pericolosi', () => {
		const html = renderMarkup('<script>alert(1)</script> <img src=x onerror=alert(1)>');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;script&gt;');
		expect(renderMarkup('[clic](javascript:alert(1))')).toBe('<p>clic)</p>');
		expect(renderMarkup('[clic](//evil.example)')).toBe('<p>clic</p>');
		expect(renderMarkup('[x](https://a.b/"onmouseover="alert(1))')).not.toContain('"onmouseover');
	});
	it('codice in linea, senza formattazione dentro', () => {
		expect(renderMarkup('Sussurro: `@Nome@ testo` e **dadi** `#2d6*`')).toBe('<p>Sussurro: <code>@Nome@ testo</code> e <strong>dadi</strong> <code>#2d6*</code></p>');
	});
	it('indirizzi delle pagine', () => {
		expect(slugify('Regole delle Quest!')).toBe('regole-delle-quest');
		expect(slugify('Città e Società')).toBe('citta-e-societa');
		expect(isSlug('guida')).toBe(true);
		expect(isSlug('Guida')).toBe(false);
		expect(isSlug('a--b')).toBe(false);
	});
});
