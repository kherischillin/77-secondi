/**
 * Testo delle missive con i collegamenti interni resi cliccabili (es. l'invito in una stanza privata).
 * Solo indirizzi del gioco riconosciuti: niente link esterni, niente HTML.
 */

export type TextSegment = { text: string } | { href: string; label: string };

const INTERNAL = /(\/gioco\/luogo\/\d{1,9})(?![\w/])/g;

export function splitInternalLinks(text: string): TextSegment[] {
	const out: TextSegment[] = [];
	let last = 0;
	for (const m of text.matchAll(INTERNAL)) {
		const at = m.index ?? 0;
		if (at > last) out.push({ text: text.slice(last, at) });
		out.push({ href: m[1], label: 'apri la chat' });
		last = at + m[0].length;
	}
	if (last < text.length) out.push({ text: text.slice(last) });
	return out;
}
