/**
 * Presta-volto da link esterno: solo HTTPS e solo dai siti ammessi dallo staff
 * (Gestione → Impostazioni). Larghezza e altezza scelte lì sono il riquadro in cui l'immagine viene mostrata.
 */

/** Siti di immagini ammessi all'inizio: servono link diretti all'immagine. */
export const DEFAULT_PORTRAIT_HOSTS = [
	'i.imgur.com',
	'i.ibb.co',
	'i.postimg.cc',
	'files.catbox.moe',
	'i.pinimg.com',
	'pbs.twimg.com',
	'upload.wikimedia.org',
	'images.unsplash.com'
];

/** Un nome di sito, eventualmente con "*." davanti per ammetterne tutti i sottodomini. */
export const HOST_PATTERN = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const PORTRAIT_URL_MAX = 500;

/** Testo dell'impostazione (uno per riga, o separati da virgole) → elenco pulito. */
export function parseHostList(text: string): { hosts: string[]; invalid: string[] } {
	const items = text
		.split(/[\s,;]+/)
		.map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
		.filter(Boolean);
	const hosts = [...new Set(items.filter((h) => HOST_PATTERN.test(h)))];
	return { hosts, invalid: items.filter((h) => !HOST_PATTERN.test(h)) };
}

export function hostAllowed(hostname: string, hosts: readonly string[]): boolean {
	const h = hostname.toLowerCase();
	return hosts.some((rule) => (rule.startsWith('*.') ? h.endsWith(rule.slice(1)) && h.length > rule.length - 1 : h === rule));
}

export type PortraitCheck = { ok: true; url: string } | { ok: false; error: string };

/** Controlla il link del presta-volto. */
export function checkPortraitUrl(raw: string, hosts: readonly string[]): PortraitCheck {
	const text = raw.trim();
	if (text.length > PORTRAIT_URL_MAX) return { ok: false, error: `Il link è troppo lungo (al massimo ${PORTRAIT_URL_MAX} caratteri).` };
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		return { ok: false, error: 'Il link non è valido: copialo per intero, a partire da https://' };
	}
	if (url.protocol !== 'https:') return { ok: false, error: 'Il link deve iniziare con https:// (connessione sicura).' };
	if (url.username || url.password || url.port) return { ok: false, error: 'Il link non può contenere nome utente, password o porta.' };
	if (!hostAllowed(url.hostname, hosts)) {
		return { ok: false, error: `Il sito «${url.hostname}» non è tra quelli ammessi per le immagini.` };
	}
	return { ok: true, url: url.href };
}

/** Vero se il valore salvato è un link (e non un vecchio file caricato sul sito). */
export const isPortraitLink = (stored: string | null | undefined): stored is string => !!stored && stored.startsWith('https://');
