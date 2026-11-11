import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { count, eq } from 'drizzle-orm';
import path from 'node:path';
import { db, schema } from './db';
import { ALL_CAPABILITIES, type Capability } from '../permissions';
import { seedBoards } from './boards.ts';

/** Nome del ruolo con tutti i poteri. È di sistema: non si può cancellare né ridurre. */
export const ADMIN_ROLE_NAME = 'Amministratore';

const DEFAULT_ROLES: {
	name: string;
	description: string;
	capabilities: Capability[];
	isSystem?: boolean;
	isDefault?: boolean;
}[] = [
	{
		name: ADMIN_ROLE_NAME,
		description: 'Controllo completo del sito.',
		capabilities: ALL_CAPABILITIES,
		isSystem: true
	},
	{
		name: 'Moderatore',
		description: 'Gestisce gli account, modera chat e bacheche, consulta il registro.',
		capabilities: ['admin.access', 'users.view', 'users.manage', 'audit.view', 'chat.moderate', 'boards.moderate']
	},
	{
		name: 'Master',
		description: 'Narra le giocate, guida le quest e assegna i PX.',
		capabilities: ['chat.master', 'chat.npc', 'xp.award']
	},
	{
		name: 'Giocatore',
		description: 'Ruolo base assegnato a ogni nuovo iscritto.',
		capabilities: [],
		isDefault: true
	}
];

/**
 * Prepara il database all'avvio del server:
 * 1. applica le migrazioni mancanti (crea o aggiorna le tabelle);
 * 2. al primissimo avvio crea i ruoli predefiniti.
 */
export async function bootstrapDatabase(): Promise<void> {
	await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });

	const [{ total }] = await db.select({ total: count() }).from(schema.roles);
	if (total === 0) {
		await db.insert(schema.roles).values(DEFAULT_ROLES);
		console.log('Ruoli predefiniti creati.');
	}

	await seedExampleRules();
	await seedBoards();

	// L'Amministratore deve sempre avere tutte le capacità, anche quelle aggiunte in versioni future.
	await db
		.update(schema.roles)
		.set({ capabilities: ALL_CAPABILITIES })
		.where(eq(schema.roles.isSystem, true));
}

/**
 * Al primo avvio con le regole crea caratteristiche e abilità di esempio,
 * che lo staff potrà modificare o cancellare dal pannello. Si fa una volta sola.
 */
async function seedExampleRules() {
	const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'rulesSeeded'));
	if (done) return;
	const [{ total }] = await db.select({ total: count() }).from(schema.stats);
	if (total === 0) {
		const created = await db
			.insert(schema.stats)
			.values([
				{ name: 'Forza', description: 'Potenza fisica, sollevare, colpire, resistere alla fatica.', sortOrder: 1 },
				{ name: 'Destrezza', description: 'Agilità, riflessi, mira, mani abili.', sortOrder: 2 },
				{ name: 'Costituzione', description: 'Resistenza, salute, tolleranza a dolore e veleni.', sortOrder: 3 },
				{ name: 'Intelligenza', description: 'Studio, memoria, ragionamento.', sortOrder: 4 },
				{ name: 'Percezione', description: 'Attenzione, sensi, intuito.', sortOrder: 5 },
				{ name: 'Carisma', description: 'Presenza, persuasione, autorità.', sortOrder: 6 }
			])
			.returning();
		const by = (name: string) => created.find((s) => s.name === name)!.id;
		await db.insert(schema.skills).values([
			{ name: 'Armi da mischia', statId: by('Forza'), sortOrder: 1 },
			{ name: 'Atletica', statId: by('Forza'), sortOrder: 2 },
			{ name: 'Armi a distanza', statId: by('Destrezza'), sortOrder: 3 },
			{ name: 'Furtività', statId: by('Destrezza'), sortOrder: 4 },
			{ name: 'Resistenza', statId: by('Costituzione'), sortOrder: 5 },
			{ name: 'Erudizione', statId: by('Intelligenza'), sortOrder: 6 },
			{ name: 'Medicina', statId: by('Intelligenza'), sortOrder: 7 },
			{ name: 'Osservare', statId: by('Percezione'), sortOrder: 8 },
			{ name: 'Persuasione', statId: by('Carisma'), sortOrder: 9 },
			{ name: 'Intimidire', statId: by('Carisma'), sortOrder: 10 }
		]);
		console.log('Regole di esempio create.');
	}
	await db.insert(schema.settings).values({ key: 'rulesSeeded', value: true }).onConflictDoNothing();
}
