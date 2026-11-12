/**
 * Sezioni personalizzabili della scheda (Aspetto, Carattere, Background, OFF Game).
 *
 * Il giocatore può scrivere testo semplice oppure HTML + CSS. Il risultato non
 * viene mai inserito nella pagina: si mostra dentro un riquadro isolato
 * (iframe con `sandbox` senza `allow-scripts`, più una Content-Security-Policy
 * che vieta gli script). Così:
 * - JavaScript non può girare in nessun caso, nemmeno con `onerror=` e simili;
 * - il CSS del giocatore vale solo dentro il suo riquadro e non tocca il resto del sito.
 *
 * Questo modulo è puro e si usa sia sul server sia nel browser (anteprima).
 * La pulizia dell'HTML vera e propria è in `#lib/server/sheet-html.ts`.
 */

export const SHEET_SECTIONS = ['appearance', 'personality', 'background', 'offGame'] as const;
export type SheetSection = (typeof SHEET_SECTIONS)[number];

/** Lunghezze massime (l'HTML con il CSS occupa più spazio del testo semplice). */
export const SHEET_LIMITS: Record<SheetSection, number> = {
	appearance: 20000,
	personality: 20000,
	background: 50000,
	offGame: 20000
};

/** Vero se il testo contiene almeno un tag HTML: altrimenti è testo semplice. */
export function looksLikeHtml(text: string): boolean {
	return /<\/?[a-z!][^>]*>/i.test(text);
}

export function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Testo semplice → HTML: paragrafi sulle righe vuote, a capo sulle righe singole. */
export function plainToHtml(text: string): string {
	return text
		.replace(/\r\n?/g, '\n')
		.trim()
		.split(/\n{2,}/)
		.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
		.join('\n');
}

const LAYOUT_TAGS = /<(?:p|br|div|section|article|header|footer|aside|main|nav|h[1-6]|blockquote|pre|ul|ol|li|dl|table|tr|td|hr|figure|details|center|style)\b/i;

/** Vero se l'HTML ha già paragrafi, a capo o blocchi suoi. */
export function hasLayoutMarkup(html: string): boolean {
	return LAYOUT_TAGS.test(html);
}

/**
 * Prepara quanto scritto dal giocatore (ancora da pulire, sul server):
 * - testo semplice → paragrafi e a capo;
 * - testo con qualche tag in linea (<b>, <i>, <span>...) → gli a capo restano a capo;
 * - HTML con un'impaginazione sua (paragrafi, div, tabelle, <style>...) → così com'è.
 */
export function prepareSheetText(raw: string | null | undefined): string | null {
	const text = raw?.replace(/\r\n?/g, '\n').trim();
	if (!text) return null;
	if (!looksLikeHtml(text)) return plainToHtml(text);
	return hasLayoutMarkup(text) ? text : text.replace(/\n/g, '<br>\n');
}

/**
 * Regole del riquadro: niente script, niente moduli, nessun altro frame.
 * Si possono caricare solo immagini, fogli di stile e caratteri via HTTPS
 * (o dal sito stesso, es. /media/...).
 */
export const FRAME_CSP = [
	"default-src 'none'",
	"script-src 'none'",
	"style-src 'unsafe-inline' https:",
	"img-src 'self' https: data:",
	"font-src https: data:",
	"form-action 'none'",
	"frame-src 'none'",
	"object-src 'none'"
].join('; ');

/** Variabili di tema copiate dalla pagina nel riquadro, così i colori di base seguono il tema scelto. */
export const FRAME_THEME_VARS = ['--text', '--text-muted', '--accent', '--border', '--bg-raised', '--bg-sunken', '--font-body', '--font-title'] as const;

/**
 * Documento completo da mettere nell'iframe (`srcdoc`).
 * Lo stile di base viene prima: il CSS del giocatore lo può sovrascrivere.
 */
export function buildFrameDoc(bodyHtml: string, theme: { vars?: Record<string, string>; colorScheme?: string } = {}): string {
	const vars = Object.entries(theme.vars ?? {})
		.filter(([k, v]) => /^--[a-z-]+$/.test(k) && v && !/[<>{};]/.test(v))
		.map(([k, v]) => `${k}:${v};`)
		.join('');
	const scheme = /^[a-z ]+$/.test(theme.colorScheme ?? '') ? theme.colorScheme : 'normal';
	return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">
<base target="_blank">
<style>
:root{${vars}color-scheme:${scheme};}
html,body{margin:0;padding:0;background:transparent;height:auto;}
body{color:var(--text,inherit);font-family:var(--font-body,system-ui,sans-serif);font-size:16px;line-height:1.6;overflow-wrap:break-word;}
body>:first-child{margin-top:0;}
body>:last-child{margin-bottom:0;}
a{color:var(--accent,inherit);}
img,video{max-width:100%;height:auto;}
h1,h2,h3,h4,h5,h6{font-family:var(--font-title,serif);line-height:1.25;}
table{border-collapse:collapse;}
hr{border:0;border-top:1px solid var(--border,#888);}
blockquote{margin:1em 0;padding-left:1em;border-left:3px solid var(--border,#888);color:var(--text-muted,inherit);}
</style>
</head><body>
${bodyHtml}
</body></html>`;
}
