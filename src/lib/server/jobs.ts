import { roleBadges, type RoleBadge } from '../role-badges.ts';
import { guildBadgesOf } from './guilds.ts';
import { and, asc, count, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { move } from './money.ts';
import { salaryStatus } from '../economy.ts';
import type { JobForm } from '../jobs.ts';

/**
 * Lavori liberi (Uffici → Lavori): il giocatore ne sceglie uno, che diventa l'occupazione
 * della scheda e dà una paga ritirabile in banca ogni `salaryIntervalHours` (come gli stipendi di gilda).
 */

export class JobError extends Error {}

const isDuplicate = (e: unknown) => String((e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code ?? '').includes('23505');

/** Elenco dei lavori, con quante persone li fanno. `all` include quelli chiusi (per lo staff). */
export async function listJobs(all = false) {
	const workers = db
		.select({ jobId: schema.characters.jobId, n: count().as('n') })
		.from(schema.characters)
		.where(isNull(schema.characters.deletedAt))
		.groupBy(schema.characters.jobId)
		.as('workers');
	const rows = await db
		.select({ job: schema.jobs, workers: workers.n })
		.from(schema.jobs)
		.leftJoin(workers, eq(workers.jobId, schema.jobs.id))
		.where(all ? undefined : eq(schema.jobs.isOpen, true))
		.orderBy(asc(schema.jobs.sortOrder), asc(schema.jobs.name));
	return rows.map((r) => ({ ...r.job, workers: Number(r.workers ?? 0) }));
}

export async function getJob(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [j] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
	return j ?? null;
}

export async function createJob(data: JobForm) {
	try {
		const [j] = await db.insert(schema.jobs).values(data).returning();
		return j;
	} catch (e) {
		if (isDuplicate(e)) throw new JobError('Esiste già un lavoro con questo nome.');
		throw e;
	}
}

export async function updateJob(id: number, data: JobForm) {
	try {
		const [j] = await db.update(schema.jobs).set(data).where(eq(schema.jobs.id, id)).returning();
		return j ?? null;
	} catch (e) {
		if (isDuplicate(e)) throw new JobError('Esiste già un lavoro con questo nome.');
		throw e;
	}
}

/** Cancella un lavoro: chi lo faceva resta senza occupazione. */
export async function deleteJob(id: number) {
	const [j] = await db.delete(schema.jobs).where(eq(schema.jobs.id, id)).returning();
	return j ?? null;
}

/** Il lavoro attuale del personaggio (anche se nel frattempo è stato chiuso). */
export async function currentJob(characterId: number) {
	const [row] = await db
		.select({ job: schema.jobs, lastPayAt: schema.characters.lastJobPayAt })
		.from(schema.characters)
		.innerJoin(schema.jobs, eq(schema.characters.jobId, schema.jobs.id))
		.where(eq(schema.characters.id, characterId));
	return row ?? null;
}

/**
 * Sceglie un lavoro. La prima paga arriva dopo un intervallo intero; cambiare lavoro
 * non azzera il conteggio (così non si guadagna niente cambiando di continuo).
 */
export async function takeJob(characterId: number, jobId: number) {
	const job = await getJob(jobId);
	if (!job || !job.isOpen) throw new JobError('Questo lavoro non è disponibile.');
	// Chi è in una gilda lavora per la gilda: niente lavoro libero.
	const [inGuild] = await db
		.select({ name: schema.guilds.name })
		.from(schema.guildMembers)
		.innerJoin(schema.guilds, eq(schema.guildMembers.guildId, schema.guilds.id))
		.where(and(eq(schema.guildMembers.characterId, characterId), eq(schema.guilds.isActive, true)))
		.limit(1);
	if (inGuild) throw new JobError(`Fai parte di ${inGuild.name}: chi è in una gilda non può avere un lavoro libero.`);
	await db
		.update(schema.characters)
		.set({ jobId: job.id, lastJobPayAt: sql`coalesce(${schema.characters.lastJobPayAt}, now())` })
		.where(eq(schema.characters.id, characterId));
	return job;
}

export async function leaveJob(characterId: number) {
	await db.update(schema.characters).set({ jobId: null }).where(eq(schema.characters.id, characterId));
}

/** Paga del lavoro per la banca: importo, se è pronta e da quando lo sarà. */
export async function jobPay(characterId: number, intervalHours: number, now = new Date()) {
	const row = await currentJob(characterId);
	if (!row || row.job.pay <= 0) return null;
	const status = salaryStatus(row.lastPayAt, now, intervalHours);
	return { name: row.job.name, icon: row.job.icon, pay: row.job.pay, ready: status.ready, nextAt: status.nextAt?.toISOString() ?? null };
}

/**
 * Ritira la paga del lavoro, dentro una transazione già aperta (la usa claimSalaries).
 * L'aggiornamento di last_job_pay_at è condizionato: due clic non pagano due volte.
 */
export async function claimJobPay(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], characterId: number, now: Date, intervalHours: number) {
	const threshold = new Date(now.getTime() - intervalHours * 3_600_000);
	const [row] = await tx
		.select({ name: schema.jobs.name, pay: schema.jobs.pay })
		.from(schema.characters)
		.innerJoin(schema.jobs, eq(schema.characters.jobId, schema.jobs.id))
		.where(and(eq(schema.characters.id, characterId), gt(schema.jobs.pay, 0)));
	if (!row) return 0;
	const claimed = await tx
		.update(schema.characters)
		.set({ lastJobPayAt: now })
		.where(
			and(
				eq(schema.characters.id, characterId),
				or(isNull(schema.characters.lastJobPayAt), lte(schema.characters.lastJobPayAt, threshold))
			)
		)
		.returning({ id: schema.characters.id });
	if (!claimed.length) return 0;
	await move(tx, characterId, 'bank', row.pay, 'salary', { note: `Lavoro: ${row.name}` });
	return row.pay;
}

/** Occupazione mostrata nella scheda, compilata in automatico: le gilde (con il grado) oppure il lavoro libero. */
export async function occupationOf(characterId: number): Promise<RoleBadge[]> {
	const [row, guilds] = await Promise.all([currentJob(characterId), guildBadgesOf([characterId])]);
	return roleBadges(row ? { name: row.job.name, icon: row.job.icon } : null, guilds.get(characterId));
}
