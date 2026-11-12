/**
 * Lettore di dump MySQL (phpMyAdmin, mysqldump, Adminer).
 *
 * Non esegue l'SQL: legge soltanto le istruzioni CREATE TABLE (per sapere l'ordine
 * delle colonne) e INSERT/REPLACE (per i dati) delle tabelle richieste. Tutto il resto
 * (commenti, SET, LOCK TABLES, tabelle non richieste come la chat) viene saltato.
 */

export type Value = string | number | null;
export type Row = Record<string, Value>;
export type Tables = Map<string, Row[]>;

export class DumpError extends Error {}

const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0', Z: '\x1a', b: '\b' };

class Scanner {
	i = 0;
	readonly s: string;
	constructor(s: string) {
		this.s = s;
	}

	get done() {
		return this.i >= this.s.length;
	}

	/** Salta spazi e commenti (-- ..., # ..., /* ... *\/). */
	skipSpace() {
		const s = this.s;
		for (;;) {
			const c = s[this.i];
			if (c === ' ' || c === '\n' || c === '\r' || c === '\t') {
				this.i++;
			} else if (c === '-' && s[this.i + 1] === '-' && (s[this.i + 2] === ' ' || s[this.i + 2] === '\n' || s[this.i + 2] === '\t' || s[this.i + 2] === '\r')) {
				const end = s.indexOf('\n', this.i);
				this.i = end === -1 ? s.length : end + 1;
			} else if (c === '#') {
				const end = s.indexOf('\n', this.i);
				this.i = end === -1 ? s.length : end + 1;
			} else if (c === '/' && s[this.i + 1] === '*') {
				const end = s.indexOf('*/', this.i + 2);
				this.i = end === -1 ? s.length : end + 2;
			} else {
				return;
			}
		}
	}

	/** Legge una stringa tra apici (singoli o doppi), con gli escape di MySQL. */
	quoted(): string {
		const s = this.s;
		const q = s[this.i++];
		let out = '';
		let start = this.i;
		for (;;) {
			if (this.i >= s.length) throw new DumpError('Il file è incompleto: una stringa non è chiusa.');
			const c = s[this.i];
			if (c === '\\') {
				out += s.slice(start, this.i);
				const n = s[this.i + 1];
				out += ESCAPES[n] ?? n;
				this.i += 2;
				start = this.i;
			} else if (c === q) {
				if (s[this.i + 1] === q) {
					out += s.slice(start, this.i + 1);
					this.i += 2;
					start = this.i;
				} else {
					out += s.slice(start, this.i);
					this.i++;
					return out;
				}
			} else {
				this.i++;
			}
		}
	}

	/** Nome tra backtick (`tabella`) o senza. */
	identifier(): string {
		this.skipSpace();
		if (this.s[this.i] === '`') {
			const end = this.s.indexOf('`', this.i + 1);
			const name = this.s.slice(this.i + 1, end);
			this.i = end + 1;
			return name;
		}
		const m = /^[A-Za-z0-9_$.]+/.exec(this.s.slice(this.i, this.i + 200));
		if (!m) throw new DumpError('Nome di tabella non riconosciuto.');
		this.i += m[0].length;
		return m[0];
	}

	/** Parola chiave successiva (in maiuscolo), senza consumarla se `peek`. */
	word(peek = false): string {
		this.skipSpace();
		const m = /^[A-Za-z_]+/.exec(this.s.slice(this.i, this.i + 40));
		if (!m) return '';
		if (!peek) this.i += m[0].length;
		return m[0].toUpperCase();
	}

	/** Va alla fine dell'istruzione (dopo il ;), rispettando le stringhe. */
	skipStatement() {
		const s = this.s;
		while (this.i < s.length) {
			const c = s[this.i];
			if (c === "'" || c === '"') this.quoted();
			else if (c === '`') this.i = s.indexOf('`', this.i + 1) + 1 || s.length;
			else if (c === ';') {
				this.i++;
				return;
			} else if (c === '-' && s[this.i + 1] === '-' && /\s/.test(s[this.i + 2] ?? '')) this.skipSpace();
			else if (c === '/' && s[this.i + 1] === '*') this.skipSpace();
			else this.i++;
		}
	}

	expect(ch: string) {
		this.skipSpace();
		if (this.s[this.i] !== ch) throw new DumpError(`Formato non riconosciuto vicino a: ${this.s.slice(this.i, this.i + 40)}`);
		this.i++;
	}

	/** Un valore: stringa, numero, NULL, 0x..., b'...', espressioni semplici come NOW(). */
	value(): Value {
		this.skipSpace();
		const s = this.s;
		const c = s[this.i];
		if (c === "'" || c === '"') return this.quoted();
		if ((c === '_' || c === 'b' || c === 'B' || c === 'x' || c === 'X') && /^(_[a-z0-9]+)?[bBxX]?'/.test(s.slice(this.i, this.i + 12))) {
			// _utf8'testo', b'0101', x'4142'
			const prefix = /^(_[a-z0-9]+)?([bBxX]?)'/.exec(s.slice(this.i, this.i + 12))!;
			this.i += prefix[0].length - 1;
			const raw = this.quoted();
			if (prefix[2].toLowerCase() === 'b') return parseInt(raw || '0', 2);
			if (prefix[2].toLowerCase() === 'x') return Buffer.from(raw, 'hex').toString('utf8');
			return raw;
		}
		const m = /^(?:0x[0-9a-fA-F]+|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|NULL|null|TRUE|FALSE|true|false|[A-Za-z_]+\(\))/.exec(s.slice(this.i, this.i + 60));
		if (!m) throw new DumpError(`Valore non riconosciuto vicino a: ${s.slice(this.i, this.i + 40)}`);
		this.i += m[0].length;
		const t = m[0];
		if (/^null$/i.test(t)) return null;
		if (/^true$/i.test(t)) return 1;
		if (/^false$/i.test(t)) return 0;
		if (t.startsWith('0x')) return Buffer.from(t.slice(2), 'hex').toString('utf8');
		if (t.endsWith('()')) return null;
		return Number(t);
	}
}

/** Colonne di una CREATE TABLE, nell'ordine in cui sono dichiarate. */
function readCreateColumns(sc: Scanner): string[] {
	sc.expect('(');
	const cols: string[] = [];
	let depth = 1;
	let atItemStart = true;
	const s = sc.s;
	while (depth > 0 && !sc.done) {
		sc.skipSpace();
		const c = s[sc.i];
		if (atItemStart) {
			atItemStart = false;
			if (c === '`') {
				cols.push(sc.identifier());
				continue;
			}
			const w = sc.word(true);
			if (w && !['PRIMARY', 'KEY', 'UNIQUE', 'INDEX', 'CONSTRAINT', 'FOREIGN', 'FULLTEXT', 'SPATIAL', 'CHECK'].includes(w)) {
				cols.push(sc.identifier());
				continue;
			}
		}
		if (c === "'" || c === '"') sc.quoted();
		else if (c === '`') sc.identifier();
		else {
			if (c === '(') depth++;
			else if (c === ')') depth--;
			else if (c === ',' && depth === 1) atItemStart = true;
			sc.i++;
		}
	}
	sc.skipStatement();
	return cols;
}

/**
 * Legge le tabelle indicate da un dump.
 * Le tabelle non presenti nel dump semplicemente non compaiono nel risultato.
 */
export function parseDump(text: string, wanted: Iterable<string>): Tables {
	const want = new Set([...wanted].map((t) => t.toLowerCase()));
	const columns = new Map<string, string[]>();
	const tables: Tables = new Map();
	const sc = new Scanner(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

	while (true) {
		sc.skipSpace();
		if (sc.done) break;
		const start = sc.i;
		const w = sc.word();
		if (w === 'CREATE') {
			if (sc.word() === 'TABLE') {
				if (sc.word(true) === 'IF') {
					sc.word();
					sc.word();
					sc.word();
				}
				const name = sc.identifier().toLowerCase();
				if (want.has(name)) {
					columns.set(name, readCreateColumns(sc));
					continue;
				}
			}
			sc.skipStatement();
		} else if (w === 'INSERT' || w === 'REPLACE') {
			let next = sc.word();
			while (next === 'IGNORE' || next === 'LOW_PRIORITY' || next === 'DELAYED' || next === 'HIGH_PRIORITY') next = sc.word();
			if (next !== 'INTO') {
				sc.i = start;
				sc.skipStatement();
				continue;
			}
			const name = sc.identifier().toLowerCase();
			if (!want.has(name)) {
				sc.skipStatement();
				continue;
			}
			sc.skipSpace();
			let cols: string[] | undefined;
			if (sc.s[sc.i] === '(') {
				sc.i++;
				cols = [];
				for (;;) {
					cols.push(sc.identifier());
					sc.skipSpace();
					if (sc.s[sc.i] === ',') sc.i++;
					else break;
				}
				sc.expect(')');
			}
			cols ??= columns.get(name);
			if (!cols) throw new DumpError(`Mancano le colonne della tabella ${name}: esporta il database con la struttura delle tabelle.`);
			const kw = sc.word();
			if (kw !== 'VALUES' && kw !== 'VALUE') throw new DumpError(`Formato di INSERT non supportato nella tabella ${name}.`);
			const rows = tables.get(name) ?? [];
			for (;;) {
				sc.expect('(');
				const row: Row = {};
				let k = 0;
				for (;;) {
					const v = sc.value();
					if (k < cols.length) row[cols[k]] = v;
					k++;
					sc.skipSpace();
					if (sc.s[sc.i] === ',') sc.i++;
					else break;
				}
				sc.expect(')');
				rows.push(row);
				sc.skipSpace();
				if (sc.s[sc.i] === ',') sc.i++;
				else break;
			}
			tables.set(name, rows);
			sc.skipSpace();
			if (sc.s[sc.i] === ';') sc.i++;
			else sc.skipStatement();
		} else if (w === '' && sc.s[sc.i] === ';') {
			// Punto e virgola isolato (es. dopo un commento /*! ... */;): niente da saltare.
			sc.i++;
		} else {
			if (sc.i === start) sc.i++;
			sc.skipStatement();
		}
	}
	return tables;
}

// ---------------------------------------------------------------------------
// Pulizia dei testi
// ---------------------------------------------------------------------------

/**
 * Corregge il testo "doppiamente codificato" (es. "Ã¨" al posto di "è"), frequente nei
 * vecchi database MySQL. Si applica solo se il risultato è UTF-8 valido.
 */
export function fixMojibake(s: string): string {
	if (!/[ÃÂ][\u0080-ÿ]/.test(s)) return s;
	// Solo se tutti i caratteri stanno in un byte: altrimenti il testo è già corretto.
	if (/[^\u0000-ÿ]/.test(s)) return s;
	const fixed = Buffer.from(s, 'latin1').toString('utf8');
	return fixed.includes('�') ? s : fixed;
}

const ENTITIES: Record<string, string> = {
	amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
	agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
	Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù',
	laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', euro: '€', deg: '°'
};

/** Da HTML (come lo salvava GDRCD) a testo semplice: a capo, niente tag, entità decodificate. */
export function htmlToText(input: string | null | undefined): string {
	if (!input) return '';
	return fixMojibake(String(input))
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e: string) => {
			if (e[0] === '#') {
				const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
				return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
			}
			return ENTITIES[e] ?? m;
		})
		.replace(/\r\n?/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
