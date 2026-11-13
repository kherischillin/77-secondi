import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDatabase, hasTestDb, makeCharacter, makeUser, outcomes } from './db.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { MoneyError, balances, claimSalaries, deposit, moneyHistory, salaries, setRankSalary, staffAdjust, transfer, withdraw } from '#lib/server/money.ts';
import { createGuild, addMemberByCharacter, listRanks } from '#lib/server/guilds.ts';
import { JobError, createJob, takeJob } from '#lib/server/jobs.ts';
import { DEFAULT_JOB_ICON } from '#lib/job-icons.ts';

describe.skipIf(!hasTestDb)('denaro (con database)', () => {
	let userId: number;

	beforeAll(async () => {
		await freshDatabase();
		userId = (await makeUser()).id;
	});

	it('il denaro iniziale finisce nei contanti e nel registro dei movimenti', async () => {
		const c = await makeCharacter(userId, { cash: 500 });
		expect(await balances(c.id)).toEqual({ money: 500, bank: 0 });
		const history = await moneyHistory(c.id);
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({ amount: 500, account: 'cash', kind: 'start' });
	});

	it('versamento e prelievo spostano il denaro senza crearne né distruggerne', async () => {
		const c = await makeCharacter(userId, { cash: 300 });
		await deposit(c.id, 200);
		expect(await balances(c.id)).toEqual({ money: 100, bank: 200 });
		await withdraw(c.id, 50);
		expect(await balances(c.id)).toEqual({ money: 150, bank: 150 });
	});

	it('non si versa né si preleva più di quanto si ha, e il saldo non cambia', async () => {
		const c = await makeCharacter(userId, { cash: 100 });
		await expect(deposit(c.id, 101)).rejects.toBeInstanceOf(MoneyError);
		await expect(withdraw(c.id, 1)).rejects.toBeInstanceOf(MoneyError);
		expect(await balances(c.id)).toEqual({ money: 100, bank: 0 });
	});

	it('un bonifico toglie a uno e dà all’altro, con due righe nel registro', async () => {
		const from = await makeCharacter(userId, { bank: 1000 });
		const to = await makeCharacter(userId, { name: 'Destinatario' });
		const found = await transfer(from.id, '  destinatario ', 400, 'affitto');
		expect(found.id).toBe(to.id);
		expect((await balances(from.id)).bank).toBe(600);
		expect((await balances(to.id)).bank).toBe(400);
		expect((await moneyHistory(from.id))[0]).toMatchObject({ amount: -400, kind: 'transfer_out', counterparty: 'Destinatario', note: 'affitto' });
		expect((await moneyHistory(to.id))[0]).toMatchObject({ amount: 400, kind: 'transfer_in' });
	});

	it('rifiuta i bonifici a se stessi, a nomi inesistenti e senza fondi', async () => {
		const from = await makeCharacter(userId, { name: 'Mittente', bank: 100 });
		const to = await makeCharacter(userId, { name: 'Ricevente' });
		await expect(transfer(from.id, 'Mittente', 10, '')).rejects.toBeInstanceOf(MoneyError);
		await expect(transfer(from.id, 'Nessuno Così', 10, '')).rejects.toBeInstanceOf(MoneyError);
		await expect(transfer(from.id, 'Ricevente', 101, '')).rejects.toBeInstanceOf(MoneyError);
		expect((await balances(from.id)).bank).toBe(100);
		expect((await balances(to.id)).bank).toBe(0);
	});

	it('dieci bonifici simultanei non spendono due volte lo stesso denaro', async () => {
		const from = await makeCharacter(userId, { bank: 300 });
		const to = await makeCharacter(userId, { name: 'Fortunato' });
		// Ci sono fondi per 3 bonifici da 100: gli altri 7 devono fallire.
		const result = await outcomes(Array.from({ length: 10 }, () => transfer(from.id, 'Fortunato', 100, '')));
		expect(result.ok).toBe(3);
		expect(result.failed).toBe(7);
		expect((await balances(from.id)).bank).toBe(0);
		expect((await balances(to.id)).bank).toBe(300);
	});

	it('la correzione dello staff non porta mai un saldo sotto zero', async () => {
		const c = await makeCharacter(userId, { cash: 50 });
		await staffAdjust(c.id, 'cash', 25, 'premio');
		await expect(staffAdjust(c.id, 'cash', -100, 'multa')).rejects.toBeInstanceOf(MoneyError);
		expect((await balances(c.id)).money).toBe(75);
	});

	it('il database stesso rifiuta un saldo negativo (vincolo CHECK)', async () => {
		const c = await makeCharacter(userId, { cash: 10 });
		await expect(db.update(schema.characters).set({ money: -1 }).where(eq(schema.characters.id, c.id))).rejects.toThrow();
		await expect(db.update(schema.characters).set({ bank: -1 }).where(eq(schema.characters.id, c.id))).rejects.toThrow();
	});

	describe('stipendi e paghe', () => {
		it('lo stipendio di gilda si ritira una volta sola per intervallo, anche con clic simultanei', async () => {
			const guild = await createGuild({ name: 'Gilda di prova', category: '', description: '', joinMode: 'open', symbol: null });
			const ranks = await listRanks(guild.id);
			const lowest = ranks.reduce((a, b) => (a.level < b.level ? a : b));
			await setRankSalary(lowest.id, 250);
			const c = await makeCharacter(userId);
			await addMemberByCharacter(guild.id, c.id, 3);

			const [status] = await salaries(c.id, 24);
			expect(status).toMatchObject({ salary: 250, ready: true });

			const paid = await Promise.all(Array.from({ length: 5 }, () => claimSalaries(c.id, 24)));
			expect(paid.reduce((a, b) => a + b, 0)).toBe(250);
			expect((await balances(c.id)).bank).toBe(250);

			// Subito dopo non c'è niente da ritirare.
			expect(await claimSalaries(c.id, 24)).toBe(0);
			expect((await salaries(c.id, 24))[0].ready).toBe(false);

			// Passato l'intervallo lo stipendio matura di nuovo.
			await db.update(schema.guildMembers).set({ lastSalaryAt: new Date(Date.now() - 25 * 3_600_000) }).where(eq(schema.guildMembers.characterId, c.id));
			expect(await claimSalaries(c.id, 24)).toBe(250);
			expect((await balances(c.id)).bank).toBe(500);
		});

		it('la paga del lavoro libero arriva dopo un intervallo intero, non appena assunti', async () => {
			const job = await createJob({ name: 'Lavoro di prova', description: '', pay: 120, icon: DEFAULT_JOB_ICON, isOpen: true, sortOrder: 0 });
			const c = await makeCharacter(userId);
			await takeJob(c.id, job.id);
			expect(await claimSalaries(c.id, 24)).toBe(0);

			await db.update(schema.characters).set({ lastJobPayAt: new Date(Date.now() - 25 * 3_600_000) }).where(eq(schema.characters.id, c.id));
			const paid = await Promise.all(Array.from({ length: 5 }, () => claimSalaries(c.id, 24)));
			expect(paid.reduce((a, b) => a + b, 0)).toBe(120);
			expect((await balances(c.id)).bank).toBe(120);
		});

		it('chi entra in gilda perde il lavoro libero e non può prenderne un altro', async () => {
			const job = await createJob({ name: 'Altro lavoro', description: '', pay: 10, icon: DEFAULT_JOB_ICON, isOpen: true, sortOrder: 0 });
			const guild = await createGuild({ name: 'Seconda gilda', category: '', description: '', joinMode: 'open', symbol: null });
			const c = await makeCharacter(userId);
			await takeJob(c.id, job.id);
			await addMemberByCharacter(guild.id, c.id, 3);
			const [row] = await db.select({ jobId: schema.characters.jobId }).from(schema.characters).where(eq(schema.characters.id, c.id));
			expect(row.jobId).toBeNull();
			await expect(takeJob(c.id, job.id)).rejects.toBeInstanceOf(JobError);
		});
	});
});
