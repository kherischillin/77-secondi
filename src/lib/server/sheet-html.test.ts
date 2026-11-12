import { describe, expect, it } from 'vitest';
import { renderSheetHtml, sanitizeSheetHtml } from './sheet-html.ts';
import { buildFrameDoc, looksLikeHtml, plainToHtml } from '#lib/sheet-html.ts';

describe('sanitizeSheetHtml', () => {
	it('toglie script, gestori di eventi e frame', () => {
		const out = sanitizeSheetHtml(
			'<p onclick="x()">ciao</p><script>alert(1)</script><img src="https://a.it/x.png" onerror="alert(1)"><iframe src="https://evil"></iframe><svg><script>1</script></svg>'
		);
		expect(out).not.toMatch(/script|onclick|onerror|iframe|svg|alert/i);
		expect(out).toContain('<p>ciao</p>');
		expect(out).toContain('<img src="https://a.it/x.png" />');
	});

	it('blocca i link javascript: e apre i link in una nuova scheda', () => {
		expect(sanitizeSheetHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript');
		expect(sanitizeSheetHtml('<a href="https://ok.it">x</a>')).toContain('target="_blank" rel="noopener noreferrer nofollow"');
	});

	it('toglie moduli, meta, base e link a fogli esterni', () => {
		const out = sanitizeSheetHtml('<form action="/x"><input name="a"><button>b</button></form><meta http-equiv="refresh" content="0"><base href="https://x"><link rel="stylesheet" href="https://x.css">');
		expect(out).not.toMatch(/form|input|button|meta|base|link/i);
	});

	it('conserva il CSS, sia nei blocchi <style> sia negli attributi', () => {
		const out = sanitizeSheetHtml('<style>.box > p { color: red; } a[href^="h"] { color: blue }</style><div class="box" style="border:1px solid red"><p>t</p></div>');
		expect(out).toContain('.box > p { color: red; }');
		expect(out).toContain('a[href^="h"]');
		expect(out).toContain('style="border:1px solid red"');
	});

	it('non permette di uscire dal blocco <style>', () => {
		const out = sanitizeSheetHtml('<style>p{}</style><script>alert(1)</script></style>');
		expect(out).not.toMatch(/<script/i);
	});

	it('neutralizza i vecchi trucchi CSS', () => {
		const out = sanitizeSheetHtml('<style>p{width:expression(alert(1));background:url(javascript:alert(1));-moz-binding:url(x)}</style>');
		expect(out).not.toMatch(/expression|javascript|-moz-binding/i);
	});
});

describe('codici dei GDR', () => {
	it('tiene le linguette fatte con radio, checkbox e label', () => {
		const out = sanitizeSheetHtml('<input type="radio" name="dato" id="storia" checked><label class="tab" for="storia" title="Storia"></label>');
		expect(out).toContain('<input type="radio" name="dato" id="storia" checked');
		expect(out).toContain('<label class="tab" for="storia" title="Storia"></label>');
	});
	it('gli altri campi di input diventano testo inerte', () => {
		const out = sanitizeSheetHtml('<input type="text" value="x"><input type="submit" formaction="https://evil"><input type="image" src="https://evil">');
		expect(out).not.toMatch(/<input|formaction|evil/);
	});
	it('tiene i tag inventati da colorare con il CSS', () => {
		const out = sanitizeSheetHtml('<style>j{color:red}</style><j>HIBIKI</j> e <x onclick="alert(1)" class="a">Okinawa</x>');
		expect(out).toContain('<j>HIBIKI</j>');
		expect(out).toContain('<x class="a">Okinawa</x>');
		expect(out).not.toContain('onclick');
	});
	it('non ammette tag pericolosi travestiti da tag inventati', () => {
		const out = sanitizeSheetHtml('<svg><script>alert(1)</script></svg><iframe src="https://x"></iframe><video src="https://x"></video><button>b</button><SCRIPT>alert(2)</SCRIPT>');
		expect(out).not.toMatch(/svg|script|iframe|video|alert|<button/i);
	});
	it('toglie <html>, <head> e <body> lasciando il contenuto', () => {
		const out = sanitizeSheetHtml('<html><head><style>p{}</style></head><body class="x"><p>ciao</p></body></html>');
		expect(out).toBe('<style>p{}</style><p>ciao</p>');
	});
});

describe('renderSheetHtml', () => {
	it('il testo semplice resta testo, con gli a capo', () => {
		expect(renderSheetHtml('Alto\ne magro\n\nOcchi 3 < 5 & "verdi"')).toBe('<p>Alto<br />e magro</p>\n<p>Occhi 3 &lt; 5 &amp; "verdi"</p>');
	});
	it('testo con qualche tag in linea: gli a capo restano', () => {
		expect(renderSheetHtml('<b>Alto</b>\ne magro')).toBe('<b>Alto</b><br />\ne magro');
	});
	it("con un'impaginazione HTML gli a capo del codice non contano", () => {
		expect(renderSheetHtml('<div>\n<b>Alto</b>\n</div>')).toBe('<div>\n<b>Alto</b>\n</div>');
	});
	it('vuoto → null', () => {
		expect(renderSheetHtml('  ')).toBeNull();
		expect(renderSheetHtml(null)).toBeNull();
	});
	it('con dei tag viene trattato come HTML', () => {
		expect(looksLikeHtml('<b>x</b>')).toBe(true);
		expect(looksLikeHtml('3 < 5 e 6 > 2')).toBe(false);
		expect(renderSheetHtml('<b>x</b>')).toBe('<b>x</b>');
	});
});

describe('buildFrameDoc', () => {
	it('vieta gli script e accetta solo variabili di tema valide', () => {
		const doc = buildFrameDoc('<p>x</p>', { vars: { '--text': '#fff', '--accent': 'red;}</style><script>' }, colorScheme: 'dark' });
		expect(doc).toContain("script-src 'none'");
		expect(doc).toContain('--text:#fff;');
		expect(doc).not.toContain('<script>');
		expect(doc).toContain('color-scheme:dark');
		expect(plainToHtml('a')).toBe('<p>a</p>');
	});
});
