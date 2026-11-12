import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/index.ts';
import { htmlToText, type Row, type Tables, type Value } from './sql-dump.ts';
import { isLegacyHash } from '../auth/legacy-password.ts';
import { PLACEHOLDER_EMAIL_DOMAIN } from '../users.ts';
import { ADMIN_ROLE_NAME } from '../bootstrap.ts';
import type { ItemBonus } from '../../economy.ts';

/**
 * Importazione dei dati da un gioco GDRCD (5.x).
 *
 * Tutto avviene in un'unica transazione: o si importa tutto, o niente.
 * L'anteprima esegue la stessa importazione e poi la annulla, così i numeri mostrati
 * sono esattamente quelli che si otterranno.
 */

export const GDRCD_TABLES = [
	'personaggio', 'abilita', 'clgpersonaggioabilita', 'mappa_click', 'mappa', 'gilda', 'codtipogilda', 'ruolo',
	'clgpersonaggioruolo', 'oggetto', 'codtipooggetto', 'mercato', 'clgpersonaggiooggetto', 'araldo', 'messaggioaraldo',
	'messaggi', 'ambientazione', 'regolamento', 'razza'
];

export const DEFAULT_STAT_NAMES = ['Forza', 'Robustezza', 'Destrezza', 'Intelligenza', 'Saggezza', 'Percezioni'];

export const importOptionsSchema = z.object({
	/** Nomi delle 6 caratteristiche (car0…car5) come configurati nel vecchio GDRCD. */
	statNames: z.array(z.string().trim().min(1).max(40)).length(6),
	/** px_x_rank della configurazione di GDRCD: serve a calcolare i PX già spesi. */
	pxPerRank: z.number().int().min(1).max(10_000),
	messages: z.boolean(),
	boards: z.boolean(),
	/** Sostituisce i testi di Regolamento e Ambientazione con quelli del vecchio gioco. */
	replacePages: z.boolean()
});
export type ImportOptions = z.infer<typeof importOptionsSchema>;

export type ImportReport = {
	counts: Record<string, number>;
	warnings: string[];
	/** Nomi utente creati (diversi dal nome del personaggio quando conteneva spazi o accenti). */
	renamed: { character: string; username: string }[];
};

class Rollback extends Error {
	readonly report: ImportReport;
	constructor(report: ImportReport) {
		super('anteprima');
		this.report = report;
	}
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Conversioni
// ---------------------------------------------------------------------------

/** "1 bacheca era" / "3 bacheche erano". */
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const str = (v: Value | undefined) => (v === null || v === undefined ? '' : String(v));
const num = (v: Value | undefined, fallback = 0) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
};
const text = (v: Value | undefined) => htmlToText(str(v));

/** Data MySQL ("2024-05-01 21:30:00", ora italiana) → Date; null se vuota o non valida. */
export function mysqlDate(v: Value | undefined): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(str(v));
	if (!m || m[1] === '0000') return null;
	const [y, mo, d, h = '0', mi = '0', s = '0'] = m.slice(1);
	const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
	if (Number.isNaN(guess)) return null;
	// Differenza tra l'ora italiana e UTC in quel giorno (tiene conto dell'ora legale).
	const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
	const p = (t: string) => Number(parts.find((x) => x.type === t)?.value);
	const asRome = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'), p('second'));
	return new Date(guess - (asRome - guess));
}

/** Nome utente valido (3-24 caratteri: lettere, numeri, . _ -) ricavato dal nome del personaggio. */
export function usernameFrom(name: string, taken: Set<string>): string {
	let base = name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, '_')
		.replace(/[^a-zA-Z0-9_.-]/g, '')
		.slice(0, 20);
	if (base.length < 3) base = (base + '_pg').slice(0, 20).padEnd(3, '_');
	let candidate = base;
	for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base}${n}`;
	taken.add(candidate.toLowerCase());
	return candidate;
}

/** Posizione GDRCD (ubicabile) → posizione nel nuovo gioco. */
export function slotFrom(ubicabile: number): string {
	switch (ubicabile) {
		case 2:
		case 3:
			return 'weapon';
		case 4:
			return 'body';
		case 5:
			return 'legs';
		case 6:
			return 'feet';
		case 7:
			return 'head';
		case 8:
		case 9:
			return 'accessory';
		default:
			return 'none';
	}
}

/** PX spesi per le abilità secondo la formula di GDRCD: px_x_rank × grado × (grado + 1) / 2. */
export function gdrcdSkillCost(ranks: number[], pxPerRank: number): number {
	return ranks.reduce((sum, g) => sum + (pxPerRank * g * (g + 1)) / 2, 0);
}

// ---------------------------------------------------------------------------
// Importazione
// ---------------------------------------------------------------------------

export async function runImport(tables: Tables, options: ImportOptions, actorUserId: number, dryRun: boolean): Promise<ImportReport> {
	try {
		return await db.transaction(async (tx) => {
			const report = await importAll(tx, tables, options, actorUserId);
			if (dryRun) throw new Rollback(report);
			return report;
		});
	} catch (e) {
		if (e instanceof Rollback) return e.report;
		throw e;
	}
}

async function importAll(tx: Tx, t: Tables, o: ImportOptions, actorUserId: number): Promise<ImportReport> {
	const rows = (name: string): Row[] => t.get(name) ?? [];
	const counts: Record<string, number> = {};
	const warnings: string[] = [];
	const renamed: ImportReport['renamed'] = [];
	const add = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

	if (!rows('personaggio').length) {
		throw new Error('Nel file non c’è la tabella "personaggio": non sembra un database di GDRCD.');
	}

	// --- Caratteristiche e abilità --------------------------------------------------
	const statIds: number[] = [];
	const maxStat = Math.max(10, ...rows('personaggio').flatMap((p) => [0, 1, 2, 3, 4, 5].map((i) => num(p[`car${i}`]))));
	const [{ lastStat }] = await tx.select({ lastStat: sql<number>`coalesce(max(${schema.stats.sortOrder}), 0)::int` }).from(schema.stats);
	for (const [i, name] of o.statNames.entries()) {
		const [existing] = await tx.select().from(schema.stats).where(sql`lower(${schema.stats.name}) = lower(${name})`);
		if (existing) {
			if (existing.maxValue < maxStat) await tx.update(schema.stats).set({ maxValue: maxStat }).where(eq(schema.stats.id, existing.id));
			statIds.push(existing.id);
		} else {
			const [s] = await tx.insert(schema.stats).values({ name, minValue: 1, maxValue: maxStat, sortOrder: lastStat + i + 1 }).returning();
			statIds.push(s.id);
			add('caratteristiche');
		}
	}

	const skillMap = new Map<number, number>();
	const maxRank = Math.max(5, ...rows('clgpersonaggioabilita').map((r) => num(r.grado)));
	for (const a of rows('abilita')) {
		const name = text(a.nome);
		if (!name) continue;
		const [existing] = await tx.select().from(schema.skills).where(sql`lower(${schema.skills.name}) = lower(${name})`);
		if (existing) {
			skillMap.set(num(a.id_abilita), existing.id);
			if (existing.maxRank < maxRank) await tx.update(schema.skills).set({ maxRank }).where(eq(schema.skills.id, existing.id));
			continue;
		}
		const [s] = await tx
			.insert(schema.skills)
			.values({ name, description: text(a.descrizione), statId: statIds[num(a.car)] ?? null, maxRank, sortOrder: 100 + num(a.id_abilita) })
			.returning();
		skillMap.set(num(a.id_abilita), s.id);
		add('abilità');
	}
	if (rows('abilita').some((a) => num(a.id_razza) > 0)) {
		warnings.push('Alcune abilità erano riservate a una razza: nel nuovo gioco le razze non esistono, quindi sono diventate abilità per tutti.');
	}

	// --- Account e personaggi ------------------------------------------------------
	const roleByName = new Map((await tx.select().from(schema.roles)).map((r) => [r.name.toLowerCase(), r]));
	const defaultRoles = [...roleByName.values()].filter((r) => r.isDefault);
	const levelRole = (permessi: number) =>
		permessi >= 4 ? roleByName.get(ADMIN_ROLE_NAME.toLowerCase()) : permessi === 3 ? roleByName.get('moderatore') : permessi === 2 ? roleByName.get('master') : undefined;

	const takenUsernames = new Set((await tx.select({ u: schema.users.username }).from(schema.users)).map((r) => r.u.toLowerCase()));
	const existingNames = new Map(
		(await tx.select({ id: schema.characters.id, userId: schema.characters.userId, name: schema.characters.name }).from(schema.characters)).map((c) => [c.name.toLowerCase(), c])
	);
	/** nome (minuscolo) → personaggio e account nel nuovo gioco. */
	const chars = new Map<string, { id: number; userId: number }>();
	/** Solo i personaggi creati da questa importazione: quelli già esistenti non si toccano. */
	const fresh = new Set<number>();
	const now = new Date();
	let guildModerators = 0;
	let noPassword = 0;

	for (const p of rows('personaggio')) {
		const name = text(p.nome);
		if (!name) continue;
		const key = name.toLowerCase();
		const clash = existingNames.get(key);
		if (clash) {
			warnings.push(`Il personaggio "${name}" esiste già: non è stato importato (i suoi dati collegati useranno quello esistente).`);
			chars.set(key, { id: clash.id, userId: clash.userId });
			add('personaggi saltati');
			continue;
		}
		const username = usernameFrom(name, takenUsernames);
		if (username !== name) renamed.push({ character: name, username });
		const pass = str(p.pass);
		if (!isLegacyHash(pass)) noPassword++;
		const exile = mysqlDate(p.esilio);
		const [user] = await tx
			.insert(schema.users)
			.values({
				username,
				email: `${username.toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`,
				// Se la password non è in un formato riconosciuto l'account non è accessibile finché lo staff non interviene.
				passwordHash: isLegacyHash(pass) ? pass : '!importato-senza-password',
				createdAt: mysqlDate(p.data_iscrizione) ?? now,
				bannedUntil: exile && exile > now ? exile : null,
				banReason: exile && exile > now ? text(p.motivo_esilio) || 'Esilio importato da GDRCD' : null
			})
			.returning({ id: schema.users.id });
		const roles = [...defaultRoles];
		const special = levelRole(num(p.permessi));
		if (special) roles.push(special);
		if (num(p.permessi) === 1) guildModerators++;
		if (roles.length) await tx.insert(schema.userRoles).values(roles.map((r) => ({ userId: user.id, roleId: r.id }))).onConflictDoNothing();

		const surname = text(p.cognome);
		const [c] = await tx
			.insert(schema.characters)
			.values({
				userId: user.id,
				name,
				surname: surname && surname !== '-' ? surname : null,
				appearance: text(p.descrizione) || null,
				personality: text(p.affetti) || null,
				background: text(p.storia) || null,
				statsAllocated: true,
				money: Math.max(0, Math.trunc(num(p.soldi))),
				bank: Math.max(0, Math.trunc(num(p.banca))),
				createdAt: mysqlDate(p.data_iscrizione) ?? now,
				lastPlayedAt: mysqlDate(p.ora_uscita)
			})
			.returning({ id: schema.characters.id });
		chars.set(key, { id: c.id, userId: user.id });
		fresh.add(c.id);
		existingNames.set(key, { id: c.id, userId: user.id, name });
		add('account');
		add('personaggi');

		await tx.insert(schema.characterStats).values(statIds.map((statId, i) => ({ characterId: c.id, statId, value: Math.max(1, Math.trunc(num(p[`car${i}`], 1))) })));
		const money = [
			{ amount: Math.max(0, Math.trunc(num(p.soldi))), account: 'cash' as const },
			{ amount: Math.max(0, Math.trunc(num(p.banca))), account: 'bank' as const }
		].filter((m) => m.amount > 0);
		if (money.length) await tx.insert(schema.moneyLog).values(money.map((m) => ({ characterId: c.id, ...m, kind: 'start' as const, note: 'Importato da GDRCD' })));
	}
	if (guildModerators) warnings.push(`${n(guildModerators, 'account era', 'account erano')} "moderatori di gilda" in GDRCD: nel nuovo gioco i poteri nella gilda dipendono dal grado, quindi hanno solo il ruolo base.`);
	if (noPassword) warnings.push(`${n(noPassword, 'account non aveva', 'account non avevano')} una password in un formato riconosciuto: non potranno entrare finché non gliene imposti una.`);
	const charOf = (n: Value | undefined) => chars.get(text(n).toLowerCase());
	const newChar = (n: Value | undefined) => {
		const c = charOf(n);
		return c && fresh.has(c.id) ? c : undefined;
	};

	// Ranghi delle abilità e PX (totali da GDRCD, spesi calcolati come faceva GDRCD).
	const ranksByChar = new Map<number, number[]>();
	for (const r of rows('clgpersonaggioabilita')) {
		const c = newChar(r.nome);
		const skillId = skillMap.get(num(r.id_abilita));
		const rank = Math.trunc(num(r.grado));
		if (!c || !skillId || rank <= 0) continue;
		await tx.insert(schema.characterSkills).values({ characterId: c.id, skillId, rank }).onConflictDoNothing();
		ranksByChar.set(c.id, [...(ranksByChar.get(c.id) ?? []), rank]);
		add('ranghi di abilità');
	}
	for (const p of rows('personaggio')) {
		const c = newChar(p.nome);
		const total = Math.floor(num(p.esperienza));
		if (!c || total <= 0) continue;
		const spent = Math.min(total, gdrcdSkillCost(ranksByChar.get(c.id) ?? [], o.pxPerRank));
		await tx.insert(schema.xpAwards).values({ characterId: c.id, amount: total, reason: 'Esperienza importata da GDRCD', awardedByUserId: actorUserId });
		await tx.update(schema.characters).set({ xpSpent: spent }).where(eq(schema.characters.id, c.id));
		add('PX importati', total);
	}

	// --- Mappe e luoghi -------------------------------------------------------------
	const mapIds = new Map<number, number>();
	const mapSize = new Map<number, { w: number; h: number }>();
	const [{ hasStart }] = await tx.select({ hasStart: sql<number>`count(*)::int` }).from(schema.maps).where(eq(schema.maps.isStart, true));
	for (const m of rows('mappa_click')) {
		const [map] = await tx
			.insert(schema.maps)
			.values({ name: text(m.nome) || `Mappa ${num(m.id_click)}`, sortOrder: num(m.posizione), isStart: !hasStart && mapIds.size === 0 })
			.returning({ id: schema.maps.id });
		mapIds.set(num(m.id_click), map.id);
		mapSize.set(num(m.id_click), { w: num(m.larghezza, 500) || 500, h: num(m.altezza, 330) || 330 });
		add('mappe');
	}
	const pct = (v: number, size: number) => Math.min(100, Math.max(0, Math.round((v / size) * 1000) / 10));
	let hiddenPages = 0;
	for (const l of rows('mappa')) {
		const mapId = mapIds.get(num(l.id_mappa));
		if (!mapId) continue;
		const size = mapSize.get(num(l.id_mappa))!;
		const linked = mapIds.get(num(l.id_mappa_collegata)) ?? null;
		const isChat = num(l.chat) === 1;
		const kind = !isChat && linked ? 'map_link' : 'chat';
		if (!isChat && !linked) hiddenPages++;
		await tx.insert(schema.locations).values({
			mapId,
			name: text(l.nome) || `Luogo ${num(l.id)}`,
			description: text(l.descrizione),
			kind,
			linkedMapId: kind === 'map_link' ? linked : null,
			x: pct(num(l.x_cord), size.w),
			y: pct(num(l.y_cord), size.h),
			isActive: isChat || !!linked,
			isPrivate: num(l.privata) === 1,
			hourlyPrice: Math.max(0, Math.trunc(num(l.costo)))
		});
		add('luoghi');
	}
	if (counts.mappe) warnings.push('Le immagini di mappe e luoghi non sono nel database: ricaricale da Gestione → Mappe e luoghi e controlla la posizione dei luoghi.');
	if (hiddenPages) warnings.push(`${n(hiddenPages, 'luogo di GDRCD era una pagina speciale', 'luoghi di GDRCD erano pagine speciali')} (non chat): importati come luoghi nascosti.`);

	// --- Gilde, gradi, membri -------------------------------------------------------
	const guildTypes = new Map(rows('codtipogilda').map((r) => [num(r.cod_tipo), text(r.descrizione)]));
	const guildIds = new Map<number, number>();
	const rankIds = new Map<number, { rankId: number; guildId: number; level: number }>();
	for (const g of rows('gilda')) {
		const name = text(g.nome);
		if (!name) continue;
		const [clash] = await tx.select({ id: schema.guilds.id }).from(schema.guilds).where(sql`lower(${schema.guilds.name}) = lower(${name})`);
		if (clash) {
			warnings.push(`La gilda "${name}" esiste già: non è stata importata.`);
			continue;
		}
		const [guild] = await tx
			.insert(schema.guilds)
			.values({ name, category: guildTypes.get(num(g.tipo)) ?? '', statute: text(g.statuto), isActive: num(g.visibile) === 1, joinMode: 'apply' })
			.returning({ id: schema.guilds.id });
		guildIds.set(num(g.id_gilda), guild.id);
		await tx.insert(schema.boards).values({ name: `Bacheca: ${name}`, description: `Bacheca riservata ai membri di ${name}.`, section: 'on', visibility: 'guild', guildId: guild.id, sortOrder: 100 });
		add('gilde');
		// Gradi: il capo in cima, poi per stipendio decrescente.
		const ranks = rows('ruolo')
			.filter((r) => num(r.gilda) === num(g.id_gilda))
			.sort((a, b) => num(b.capo) - num(a.capo) || num(b.stipendio) - num(a.stipendio));
		for (const [i, r] of ranks.entries()) {
			const level = (ranks.length - i) * 10;
			const [rank] = await tx
				.insert(schema.guildRanks)
				.values({ guildId: guild.id, name: text(r.nome_ruolo) || `Grado ${i + 1}`, level, canManage: num(r.capo) === 1, salary: Math.max(0, Math.trunc(num(r.stipendio))) })
				.returning({ id: schema.guildRanks.id });
			rankIds.set(num(r.id_ruolo), { rankId: rank.id, guildId: guild.id, level });
			add('gradi di gilda');
		}
	}
	const jobs = rows('ruolo').filter((r) => num(r.gilda) < 0).length;
	if (jobs) warnings.push(`${n(jobs, '"lavoro" di GDRCD (ruolo senza gilda) non è stato importato', '"lavori" di GDRCD (ruoli senza gilda) non sono stati importati')}: puoi ricrearli come gilde con stipendio.`);
	// Un personaggio può avere più ruoli nella stessa gilda: si tiene il grado più alto.
	const best = new Map<string, { characterId: number; guildId: number; rankId: number; level: number }>();
	for (const m of rows('clgpersonaggioruolo')) {
		const c = newChar(m.personaggio);
		const rank = rankIds.get(num(m.id_ruolo));
		if (!c || !rank) continue;
		const k = `${c.id}:${rank.guildId}`;
		if ((best.get(k)?.level ?? -1) < rank.level) best.set(k, { characterId: c.id, ...rank });
	}
	for (const m of best.values()) {
		await tx.insert(schema.guildMembers).values({ guildId: m.guildId, characterId: m.characterId, rankId: m.rankId }).onConflictDoNothing();
		add('membri di gilda');
	}

	// --- Oggetti, mercato, inventari ------------------------------------------------
	const itemTypes = new Map(rows('codtipooggetto').map((r) => [num(r.cod_tipo), text(r.descrizione)]));
	const market = new Map(rows('mercato').map((r) => [num(r.id_oggetto), Math.max(0, Math.trunc(num(r.numero)))]));
	const itemIds = new Map<number, { id: number; slot: string }>();
	for (const it of rows('oggetto')) {
		const bonuses: ItemBonus[] = [0, 1, 2, 3, 4, 5]
			.map((i) => ({ statId: statIds[i], value: Math.trunc(num(it[`bonus_car${i}`])) }))
			.filter((b) => b.value !== 0 && b.statId)
			.map((b) => ({ statId: b.statId, value: Math.max(-50, Math.min(50, b.value)) }));
		const slot = slotFrom(num(it.ubicabile));
		const inMarket = market.has(num(it.id_oggetto));
		const [item] = await tx
			.insert(schema.items)
			.values({
				name: text(it.nome) || 'Oggetto',
				description: text(it.descrizione),
				category: itemTypes.get(num(it.tipo)) ?? '',
				slot,
				price: Math.max(0, Math.trunc(num(it.costo))),
				forSale: inMarket,
				stock: inMarket ? market.get(num(it.id_oggetto))! : null,
				bonuses
			})
			.returning({ id: schema.items.id });
		itemIds.set(num(it.id_oggetto), { id: item.id, slot });
		add('oggetti');
	}
	for (const ci of rows('clgpersonaggiooggetto')) {
		const c = newChar(ci.nome);
		const item = itemIds.get(num(ci.id_oggetto));
		const quantity = Math.max(1, Math.trunc(num(ci.numero, 1)));
		if (!c || !item) continue;
		if (item.slot === 'none') {
			await tx.insert(schema.characterItems).values({ characterId: c.id, itemId: item.id, quantity });
		} else {
			// Indossato se in GDRCD era in una posizione del corpo (2-9).
			const worn = num(ci.posizione) >= 2;
			await tx.insert(schema.characterItems).values(Array.from({ length: Math.min(quantity, 100) }, (_, i) => ({ characterId: c.id, itemId: item.id, quantity: 1, equipped: worn && i === 0 })));
		}
		add('oggetti posseduti', quantity);
	}

	// --- Bacheche -------------------------------------------------------------------
	if (o.boards) {
		const boardIds = new Map<number, { id: number; on: boolean }>();
		let restricted = 0;
		for (const b of rows('araldo')) {
			const tipo = num(b.tipo);
			const guildId = tipo === 3 ? (guildIds.get(num(b.proprietari)) ?? null) : null;
			const visibility = tipo <= 1 ? 'all' : tipo === 3 && guildId ? 'guild' : 'staff';
			if (tipo === 2 || (tipo === 3 && !guildId)) restricted++;
			const [board] = await tx
				.insert(schema.boards)
				.values({ name: text(b.nome) || 'Bacheca', section: tipo === 0 || tipo === 3 ? 'on' : 'off', visibility, guildId, sortOrder: 50 + num(b.id_araldo) })
				.returning({ id: schema.boards.id });
			boardIds.set(num(b.id_araldo), { id: board.id, on: tipo === 0 || tipo === 3 });
			add('bacheche');
		}
		if (restricted) warnings.push(`${n(restricted, 'bacheca era riservata', 'bacheche erano riservate')} a una razza o a una gilda non importata: ora solo lo staff la vede.`);
		const threads = new Map<number, number>();
		const posts = rows('messaggioaraldo').sort((a, b) => num(a.id_messaggio) - num(b.id_messaggio));
		const authorOf = (board: { on: boolean }, autore: Value) => {
			const c = charOf(autore);
			return { authorCharacterId: board.on ? (c?.id ?? null) : null, authorUserId: c?.userId ?? null };
		};
		for (const m of posts.filter((p) => num(p.id_messaggio_padre) <= 0)) {
			const board = boardIds.get(num(m.id_araldo));
			if (!board) continue;
			const at = mysqlDate(m.data_messaggio) ?? now;
			const [th] = await tx
				.insert(schema.boardThreads)
				.values({
					boardId: board.id,
					title: text(m.titolo) || 'Discussione',
					...authorOf(board, m.autore),
					isPinned: str(m.importante) === '1' || num(m.importante) === 1,
					isLocked: str(m.chiuso) === '1' || num(m.chiuso) === 1,
					createdAt: at,
					lastPostAt: mysqlDate(m.data_ultimo_messaggio) ?? at
				})
				.returning({ id: schema.boardThreads.id });
			threads.set(num(m.id_messaggio), th.id);
			await tx.insert(schema.boardPosts).values({ threadId: th.id, ...authorOf(board, m.autore), body: text(m.messaggio) || '…', createdAt: at });
			add('discussioni');
			add('messaggi in bacheca');
		}
		for (const m of posts.filter((p) => num(p.id_messaggio_padre) > 0)) {
			const threadId = threads.get(num(m.id_messaggio_padre));
			const board = boardIds.get(num(m.id_araldo));
			if (!threadId || !board) continue;
			await tx.insert(schema.boardPosts).values({ threadId, ...authorOf(board, m.autore), body: text(m.messaggio) || '…', createdAt: mysqlDate(m.data_messaggio) ?? now });
			add('messaggi in bacheca');
		}
	}

	// --- Missive --------------------------------------------------------------------
	if (o.messages) {
		const conv = new Map<string, { a: number; b: number; onGame: boolean; subject: string; items: Row[] }>();
		for (const m of rows('messaggi')) {
			const from = charOf(m.mittente);
			const to = charOf(m.destinatario);
			if (!from || !to || from.id === to.id) continue;
			if (num(m.mittente_del) === 1 && num(m.destinatario_del) === 1) continue;
			const [a, b] = from.id < to.id ? [from.id, to.id] : [to.id, from.id];
			const onGame = num(m.tipo) === 1;
			const k = `${a}:${b}:${onGame}`;
			if (!conv.has(k)) conv.set(k, { a, b, onGame, subject: text(m.oggetto) || 'Missive importate', items: [] });
			conv.get(k)!.items.push(m);
		}
		for (const c of conv.values()) {
			c.items.sort((x, y) => (mysqlDate(x.spedito)?.getTime() ?? 0) - (mysqlDate(y.spedito)?.getTime() ?? 0));
			const last = mysqlDate(c.items[c.items.length - 1].spedito) ?? now;
			const [th] = await tx
				.insert(schema.messageThreads)
				.values({ subject: c.subject.slice(0, 120), onGame: c.onGame, createdAt: mysqlDate(c.items[0].spedito) ?? now, lastMessageAt: last })
				.returning({ id: schema.messageThreads.id });
			// Tutto segnato come già letto: niente valanga di notifiche al primo accesso.
			await tx.insert(schema.messageParticipants).values([
				{ threadId: th.id, characterId: c.a, lastReadAt: now },
				{ threadId: th.id, characterId: c.b, lastReadAt: now }
			]);
			await tx.insert(schema.privateMessages).values(
				c.items.map((m) => {
					const subject = text(m.oggetto);
					const body = text(m.testo) || '…';
					return {
						threadId: th.id,
						senderCharacterId: charOf(m.mittente)!.id,
						body: subject && subject !== c.subject ? `[${subject}]\n${body}` : body,
						createdAt: mysqlDate(m.spedito) ?? now
					};
				})
			);
			add('conversazioni');
			add('missive', c.items.length);
		}
	}

	// --- Regolamento e ambientazione ------------------------------------------------
	if (o.replacePages) {
		const chapters = (table: string, numberCol: string) =>
			rows(table)
				.sort((a, b) => num(a[numberCol]) - num(b[numberCol]))
				.map((r) => `# ${text(r.titolo) || 'Capitolo'}\n\n${text(r.testo)}`)
				.join('\n\n');
		for (const [slug, table, col, title] of [
			['regolamento', 'regolamento', 'articolo', 'Regolamento'],
			['ambientazione', 'ambientazione', 'capitolo', 'Ambientazione']
		] as const) {
			if (!rows(table).length) continue;
			const body = chapters(table, col);
			const [page] = await tx.select({ id: schema.pages.id }).from(schema.pages).where(eq(schema.pages.slug, slug));
			if (page) await tx.update(schema.pages).set({ body, updatedAt: now, updatedByUserId: actorUserId }).where(eq(schema.pages.id, page.id));
			else await tx.insert(schema.pages).values({ slug, title, body, updatedByUserId: actorUserId });
			add('pagine');
		}
	}

	if (rows('razza').length) warnings.push('Le razze di GDRCD non esistono nel nuovo gioco e non sono state importate.');
	warnings.push('Ritratti e immagini dei personaggi non sono stati importati (erano file o link esterni).');
	return { counts, warnings, renamed };
}
