import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { count, eq } from 'drizzle-orm';
import path from 'node:path';
import { db, schema } from './db';
import { ALL_CAPABILITIES, type Capability } from '../permissions';

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
		description: 'Gestisce gli account e consulta il registro.',
		capabilities: ['admin.access', 'users.view', 'users.manage', 'audit.view']
	},
	{
		name: 'Master',
		description: 'Narra le giocate e muove i PNG.',
		capabilities: ['chat.master', 'chat.npc']
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

	// L'Amministratore deve sempre avere tutte le capacità, anche quelle aggiunte in versioni future.
	await db
		.update(schema.roles)
		.set({ capabilities: ALL_CAPABILITIES })
		.where(eq(schema.roles.isSystem, true));
}
