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
	// Il CSS del giocatore
	'style'
];

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
		q: ['cite']
	},
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedSchemesByTag: { img: ['https', 'data'] },
	allowProtocolRelative: false,
	// Tutto ciò che non è ammesso sparisce insieme al contenuto (script, iframe, form...).
	disallowedTagsMode: 'discard',
	nonTextTags: ['script', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'title'],
	transformTags: {
		'*': (tagName, attribs) => {
			if (attribs.style) attribs.style = cleanCss(attribs.style);
			return { tagName, attribs };
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
	const clean = sanitizeHtml(html, OPTIONS);
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
