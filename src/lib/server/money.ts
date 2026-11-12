import { and, desc, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { salaryStatus } from '../economy.ts';
import { fullName } from '../format.ts';
import { claimJobPay } from './jobs.ts';

/**
 * Denaro dei personaggi: contanti (money) e conto in banca (bank).
 *
 * Ogni operazione è una transazione: il saldo si modifica con un UPDATE condizionato
 * ("solo se c'è abbastanza denaro"), quindi due richieste simultanee non possono mai
 * spendere lo stesso denaro due volte. Ogni variazione lascia una riga in money_log.
 */

export class MoneyError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Account = 'cash' | 'bank';
type Kind = (typeof schema.moneyLog.$inferInsert)['kind'];

const column = (account: Account) => (account === 'cash' ? schema.characters.money : schema.characters.bank);

/**
 * Aggiunge (o toglie, se negativo) denaro a un conto. Restituisce false se non ce n'è abbastanza.
 * Va chiamata dentro una transazione.
 */
export async function move(
	tx: Tx,
	characterId: number,
	account: Account,
	amount: number,
	kind: Kind,
	opts: { note?: string; counterpartyCharacterId?: number | null } = {}
): Promise<boolean> {
	if (amount === 0) return true;
	const col = column(account);
	const updated = await tx
		.update(schema.characters)
		.set(account === 'cash' ? { money: sql`${col} + ${amount}` } : { bank: sql`${col} + ${amount}` })
		.where(and(eq(schema.characters.id, characterId), amount < 0 ? gte(col, -amount) : undefined))
		.returning({ id: schema.characters.id });
	if (!updated.length) return false;
	await tx.insert(schema.moneyLog).values({
		characterId,
		amount,
		account,
		kind,
		note: opts.note ?? '',
		counterpartyCharacterId: opts.counterpartyCharacterId ?? null
	});
	return true;
}

export async function balances(characterId: number) {
	const [row] = await db
		.select({ money: schema.characters.money, bank: schema.characters.bank })
		.from(schema.characters)
		.where(eq(schema.characters.id, characterId));
	return row ?? { money: 0, bank: 0 };
}

export async function deposit(characterId: number, amount: number) {
	await db.transaction(async (tx) => {
		if (!(await move(tx, characterId, 'cash', -amount, 'deposit'))) throw new MoneyError('Non hai abbastanza contanti.');
		await move(tx, characterId, 'bank', amount, 'deposit');
	});
}

export async function withdraw(characterId: number, amount: number) {
	await db.transaction(async (tx) => {
		if (!(await move(tx, characterId, 'bank', -amount, 'withdraw'))) throw new MoneyError('Non hai abbastanza denaro sul conto.');
		await move(tx, characterId, 'cash', amount, 'withdraw');
	});
}

/** Cerca un personaggio attivo per nome (o nome e cognome). */
export async function findCharacterByName(name: string) {
	const wanted = name.trim().toLowerCase();
	if (!wanted) return null;
	const [c] = await db
		.select({ id: schema.characters.id, userId: schema.characters.userId, name: schema.characters.name, surname: schema.characters.surname })
		.from(schema.characters)
		.where(
			and(
				isNull(schema.characters.deletedAt),
				or(
					sql`lower(${schema.characters.name}) = ${wanted}`,
					sql`lower(${schema.characters.name} || ' ' || coalesce(${schema.characters.surname}, '')) = ${wanted}`
				)
			)
		)
		.limit(1);
	return c ?? null;
}

/** Bonifico dal conto di un personaggio a quello di un altro. */
export async function transfer(fromId: number, toName: string, amount: number, note: string) {
	const to = await findCharacterByName(toName);
	if (!to) throw new MoneyError(`Nessun personaggio si chiama "${toName}".`);
	if (to.id === fromId) throw new MoneyError('Non puoi fare un bonifico a te stesso.');
	await db.transaction(async (tx) => {
		if (!(await move(tx, fromId, 'bank', -amount, 'transfer_out', { note, counterpartyCharacterId: to.id }))) {
			throw new MoneyError('Non hai abbastanza denaro sul conto.');
		}
		await move(tx, to.id, 'bank', amount, 'transfer_in', { note, counterpartyCharacterId: fromId });
	});
	return to;
}

/** Correzione dello staff (premio, multa, rimborso). Non scende mai sotto zero. */
export async function staffAdjust(characterId: number, account: Account, amount: number, note: string) {
	await db.transaction(async (tx) => {
		if (!(await move(tx, characterId, account, amount, 'staff', { note }))) {
			throw new MoneyError('Il personaggio non ha abbastanza denaro per togliere questa cifra.');
		}
	});
}

/** Movimenti recenti, con il nome della controparte. */
export async function moneyHistory(characterId: number, limit = 50) {
	const rows = await db
		.select({
			log: schema.moneyLog,
			otherName: schema.characters.name,
			otherSurname: schema.characters.surname
		})
		.from(schema.moneyLog)
		.leftJoin(schema.characters, eq(schema.moneyLog.counterpartyCharacterId, schema.characters.id))
		.where(eq(schema.moneyLog.characterId, characterId))
		.orderBy(desc(schema.moneyLog.id))
		.limit(limit);
	return rows.map(({ log, otherName, otherSurname }) => ({
		id: log.id,
		amount: log.amount,
		account: log.account,
		kind: log.kind,
		note: log.note,
		counterparty: otherName ? fullName({ name: otherName, surname: otherSurname }) : null,
		createdAt: log.createdAt.toISOString()
	}));
}

// ---------------------------------------------------------------------------
// Stipendi di gilda
// ---------------------------------------------------------------------------

/** Stipendi del personaggio: uno per ogni gilda in cui ha un grado pagato. */
export async function salaries(characterId: number, intervalHours: number, now = new Date()) {
	const rows = await db
		.select({
			guildId: schema.guilds.id,
			guildName: schema.guilds.name,
			rankName: schema.guildRanks.name,
			salary: schema.guildRanks.salary,
			lastSalaryAt: schema.guildMembers.lastSalaryAt
		})
		.from(schema.guildMembers)
		.innerJoin(schema.guilds, eq(schema.guildMembers.guildId, schema.guilds.id))
		.innerJoin(schema.guildRanks, eq(schema.guildMembers.rankId, schema.guildRanks.id))
		.where(and(eq(schema.guildMembers.characterId, characterId), gt(schema.guildRanks.salary, 0)));
	return rows.map((r) => {
		const status = salaryStatus(r.lastSalaryAt, now, intervalHours);
		return { ...r, lastSalaryAt: r.lastSalaryAt?.toISOString() ?? null, ready: status.ready, nextAt: status.nextAt?.toISOString() ?? null };
	});
}

/**
 * Ritira tutti gli stipendi maturati. L'aggiornamento di last_salary_at è condizionato:
 * cliccare due volte (o da due schede) non paga due volte.
 */
export async function claimSalaries(characterId: number, intervalHours: number) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const threshold = new Date(now.getTime() - intervalHours * 3_600_000);
		const due = await tx
			.select({ guildId: schema.guildMembers.guildId, guildName: schema.guilds.name, salary: schema.guildRanks.salary })
			.from(schema.guildMembers)
			.innerJoin(schema.guilds, eq(schema.guildMembers.guildId, schema.guilds.id))
			.innerJoin(schema.guildRanks, eq(schema.guildMembers.rankId, schema.guildRanks.id))
			.where(
				and(
					eq(schema.guildMembers.characterId, characterId),
					gt(schema.guildRanks.salary, 0),
					or(isNull(schema.guildMembers.lastSalaryAt), lte(schema.guildMembers.lastSalaryAt, threshold))
				)
			);
		let total = 0;
		for (const d of due) {
			const claimed = await tx
				.update(schema.guildMembers)
				.set({ lastSalaryAt: now })
				.where(
					and(
						eq(schema.guildMembers.guildId, d.guildId),
						eq(schema.guildMembers.characterId, characterId),
						or(isNull(schema.guildMembers.lastSalaryAt), lte(schema.guildMembers.lastSalaryAt, threshold))
					)
				)
				.returning({ g: schema.guildMembers.guildId });
			if (!claimed.length) continue;
			await move(tx, characterId, 'bank', d.salary, 'salary', { note: d.guildName });
			total += d.salary;
		}
		// Paga del lavoro libero (Uffici → Lavori), con lo stesso intervallo.
		total += await claimJobPay(tx, characterId, now, intervalHours);
		return total;
	});
}

/** Tutti i gradi di tutte le gilde, per impostare gli stipendi dal pannello. */
export async function listRankSalaries() {
	return db
		.select({ rankId: schema.guildRanks.id, rankName: schema.guildRanks.name, level: schema.guildRanks.level, salary: schema.guildRanks.salary, guildId: schema.guilds.id, guildName: schema.guilds.name })
		.from(schema.guildRanks)
		.innerJoin(schema.guilds, eq(schema.guildRanks.guildId, schema.guilds.id))
		.orderBy(schema.guilds.name, desc(schema.guildRanks.level));
}

export async function setRankSalary(rankId: number, salary: number) {
	const [r] = await db.update(schema.guildRanks).set({ salary }).where(eq(schema.guildRanks.id, rankId)).returning();
	return r ?? null;
}
