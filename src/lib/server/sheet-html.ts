import sanitizeHtml from 'sanitize-html';
import { prepareSheetText } from '#lib/sheet-html.ts';

/**
 * Pulizia dell'HTML scritto dai giocatori nelle sezioni della scheda.
 *
 * È la prima barriera: toglie script, gestori di eventi (onclick, onerror...),
 * frame, moduli e link `javascript:`. La seconda barriera è il riquadro isolato
 * in cui l'HTML viene mostrato (vedi `#lib/sheet-html.ts`), che vieta comunque
 * qualsiasi script.
 */

const TAGS = [
	// Struttura e testo
	'div', 'span', 'p', 'br', 'hr', 'section', 'article', 'header', 'footer', 'aside', 'main', 'nav',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'kbd', 'samp',
	'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'mark', 'small', 'big', 'sub', 'sup',
	'abbr', 'cite', 'q', 'dfn', 'time', 'center', 'font',
	// Elenchi e tabelle
	'ul', 'ol', 'li', 'dl', 'dt', 'dd',
	'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
	// Immagini, link, blocchi apribili (funzionano senza JavaScript)
	'img', 'figure', 'figcaption', 'picture', 'a', 'details', 'summary',
	// Linguette e sezioni cliccabili senza JavaScript (il "trucco" con radio/checkbox + label + CSS)
	'input', 'label',
	// Classici dei vecchi GDR
	'marquee', 'tt', 'var', 'bdi', 'bdo', 'wbr', 'ruby', 'rt', 'rp', 'data', 'meter', 'progress', 'fieldset', 'legend',
	// Il CSS del giocatore
	'style'
];

/**
 * Tag che non passano mai, nemmeno come tag "inventati": script, frame e incorporamenti,
 * moduli, metadati della pagina, SVG/MathML (che possono contenere script), audio e video.
 */
const BLOCKED = new Set([
	'script', 'noscript', 'iframe', 'frame', 'frameset', 'noframes', 'object', 'embed', 'applet', 'param',
	'form', 'button', 'select', 'option', 'optgroup', 'textarea', 'datalist', 'keygen', 'isindex',
	'meta', 'link', 'base', 'title', 'head', 'html', 'body',
	'svg', 'math', 'template', 'slot', 'portal', 'image',
	'audio', 'video', 'source', 'track', 'canvas', 'xmp', 'plaintext', 'noembed'
]);

/** Nome valido per un tag inventato dal giocatore (es. <j>, <k>, <x>, <titolo-rosso>). */
const CUSTOM_TAG = /^[a-z][a-z0-9-]{0,30}$/;

/**
 * Molti codici dei GDR usano tag inventati (<j>, <k>, <x>...) da colorare con il CSS.
 * Li ammettiamo, con gli stessi attributi innocui degli altri tag, purché non siano tra quelli bloccati.
 */
export function customTagsIn(html: string): string[] {
	const names = new Set<string>();
	for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)) {
		const name = m[1].toLowerCase();
		if (CUSTOM_TAG.test(name) && !BLOCKED.has(name) && !TAGS.includes(name)) names.add(name);
	}
	return [...names];
}

/** Tipi di <input> ammessi: servono solo per le linguette fatte in CSS. */
const INPUT_TYPES = new Set(['radio', 'checkbox']);

const COMMON_ATTRS = ['class', 'id', 'style', 'title', 'lang', 'dir', 'align', 'valign', 'width', 'height', 'bgcolor'];

const OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: TAGS,
	// `style` è nella lista dei tag "vulnerabili" solo perché il CSS non viene analizzato:
	// qui il CSS gira in un riquadro senza script, quindi non può eseguire codice.
	allowVulnerableTags: true,
	allowedAttributes: {
		'*': COMMON_ATTRS,
		a: ['href', 'name', 'target', 'rel'],
		img: ['src', 'alt', 'loading'],
		font: ['color', 'face', 'size'],
		ol: ['start', 'type', 'reversed'],
		ul: ['type'],
		li: ['value'],
		td: ['colspan', 'rowspan', 'nowrap'],
		th: ['colspan', 'rowspan', 'scope', 'nowrap'],
		col: ['span'],
		colgroup: ['span'],
		table: ['border', 'cellpadding', 'cellspacing', 'summary'],
		details: ['open'],
		time: ['datetime'],
		blockquote: ['cite'],
		q: ['cite'],
		input: ['type', 'name', 'checked', 'value'],
		label: ['for'],
		marquee: ['behavior', 'direction', 'scrollamount', 'scrolldelay', 'loop'],
		meter: ['value', 'min', 'max', 'low', 'high', 'optimum'],
		progress: ['value', 'max']
	},
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedSchemesByTag: { img: ['https', 'data'] },
	allowProtocolRelative: false,
	// Tutto ciò che non è ammesso sparisce insieme al contenuto (script, iframe, form...).
	disallowedTagsMode: 'discard',
	nonTextTags: ['script', 'textarea', 'option', 'select', 'datalist', 'noscript', 'iframe', 'object', 'embed', 'applet', 'svg', 'math', 'template', 'title', 'xmp', 'noembed', 'noframes', 'plaintext'],
	transformTags: {
		'*': (tagName, attribs) => {
			if (attribs.style) attribs.style = cleanCss(attribs.style);
			return { tagName, attribs };
		},
		// Solo caselle e pulsanti di scelta (per le linguette in CSS): gli altri campi diventano testo.
		input: (tagName, attribs) => {
			const type = (attribs.type ?? '').toLowerCase();
			if (!INPUT_TYPES.has(type)) return { tagName: 'span', attribs: {} };
			const out: Record<string, string> = { ...attribs, type };
			if (out.style) out.style = cleanCss(out.style);
			return { tagName, attribs: out };
		},
		// I link si aprono sempre in una nuova scheda, senza dare accesso alla pagina di origine.
		a: (tagName, attribs) => {
			const out: Record<string, string> = { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' };
			if (out.style) out.style = cleanCss(out.style);
			return { tagName, attribs: out };
		}
	}
};

/**
 * Toglie dal CSS i vecchi trucchi per eseguire codice (non funzionano più nei
 * browser moderni, ma non c'è motivo di lasciarli).
 */
export function cleanCss(css: string): string {
	return css
		.replace(/<\/?\s*style/gi, '')
		.replace(/expression\s*\(/gi, '(')
		.replace(/(?:java|vb)script\s*:/gi, '')
		.replace(/-moz-binding\s*:/gi, '-x-binding:')
		.replace(/behavior\s*:/gi, '-x-behavior:');
}

/** Pulisce l'HTML e il CSS contenuto nei blocchi `<style>`. */
export function sanitizeSheetHtml(html: string): string {
	// <html>, <head> e <body> copiati da una pagina intera: si tolgono i tag ma si tiene il contenuto.
	const body = html.replace(/<\/?(?:html|head|body)(?=[\s>/])[^>]*>/gi, '');
	const clean = sanitizeHtml(body, { ...OPTIONS, allowedTags: [...TAGS, ...customTagsIn(body)] });
	return clean.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open: string, css: string, close: string) => open + cleanCss(css) + close);
}

/**
 * Da quanto ha scritto il giocatore all'HTML sicuro da mostrare nel riquadro.
 * Testo senza tag: rimane testo, con i suoi a capo.
 */
export function renderSheetHtml(raw: string | null | undefined): string | null {
	const markup = prepareSheetText(raw);
	return markup === null ? null : sanitizeSheetHtml(markup);
}
