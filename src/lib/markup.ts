/**
 * Formattazione semplice per le pagine scritte dallo staff (Guida, Regolamento, Ambientazione).
 *
 * Si scrive testo normale con pochi segni:
 *   # Titolo, ## Sottotitolo, ### Paragrafo
 *   **grassetto**, *corsivo*
 *   - elenco puntato, 1. elenco numerato
 *   > citazione
 *   [testo del link](https://indirizzo) oppure [testo](/pagine/regolamento)
 *   `codice` (es. la sintassi della chat)
 *   --- linea di separazione
 *
 * Tutto il resto viene "neutralizzato": l'HTML scritto a mano non viene mai eseguito.
 */

export function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Solo link sicuri: http(s), mailto o percorsi interni. */
function safeHref(url: string): string | null {
	const u = url.trim();
	if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
	if (u.startsWith('/') && !u.startsWith('//')) return u;
	if (u.startsWith('#')) return u;
	return null;
}

/** Formattazione dentro una riga: `codice` resta com'è, il resto si formatta. */
function inline(raw: string): string {
	return raw
		.split(/`([^`\n]+)`/)
		.map((part, i) => (i % 2 ? `<code>${escapeHtml(part)}</code>` : formatText(part)))
		.join('');
}

function formatText(raw: string): string {
	let s = escapeHtml(raw);
	// Link: [testo](indirizzo). L'indirizzo è già neutralizzato, quindi niente virgolette o tag.
	s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, text: string, href: string) => {
		const decoded = href.replace(/&amp;/g, '&');
		const safe = safeHref(decoded);
		if (!safe) return text;
		const external = /^https?:/i.test(safe);
		return `<a href="${escapeHtml(safe)}"${external ? ' rel="noopener noreferrer nofollow" target="_blank"' : ''}>${text}</a>`;
	});
	s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
	return s;
}

export function renderMarkup(source: string): string {
	const lines = source.replace(/\r\n?/g, '\n').split('\n');
	const out: string[] = [];
	let paragraph: string[] = [];
	let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
	let quote: string[] = [];

	const flushParagraph = () => {
		if (paragraph.length) out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
		paragraph = [];
	};
	const flushList = () => {
		if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
		list = null;
	};
	const flushQuote = () => {
		if (quote.length) out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
		quote = [];
	};
	const flushAll = () => {
		flushParagraph();
		flushList();
		flushQuote();
	};

	for (const line of lines) {
		const t = line.trim();
		if (!t) {
			flushAll();
			continue;
		}
		const heading = /^(#{1,3})\s+(.+)$/.exec(t);
		if (heading) {
			flushAll();
			// Nella pagina il titolo principale è già h1: i titoli del testo partono da h2.
			const level = heading[1].length + 1;
			out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
			continue;
		}
		if (/^-{3,}$/.test(t)) {
			flushAll();
			out.push('<hr>');
			continue;
		}
		const ul = /^[-*]\s+(.+)$/.exec(t);
		const ol = /^\d+[.)]\s+(.+)$/.exec(t);
		if (ul || ol) {
			flushParagraph();
			flushQuote();
			const type = ul ? 'ul' : 'ol';
			if (list && list.type !== type) flushList();
			list ??= { type, items: [] };
			list.items.push((ul ?? ol)![1]);
			continue;
		}
		const q = /^>\s?(.*)$/.exec(t);
		if (q) {
			flushParagraph();
			flushList();
			quote.push(q[1]);
			continue;
		}
		flushList();
		flushQuote();
		paragraph.push(t);
	}
	flushAll();
	return out.join('\n');
}

/** Il testo è un identificatore valido per l'indirizzo di una pagina? */
export function isSlug(s: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 60;
}

/** Ricava un indirizzo dal titolo: "Regole delle quest" → "regole-delle-quest". */
export function slugify(title: string): string {
	return title
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/g, '');
}
