import { db, schema } from './db';

type AuditEntry = {
	actorUserId?: number | null;
	action: string;
	targetType?: string;
	targetId?: string | number;
	details?: Record<string, unknown>;
	ip?: string | null;
};

/** Scrive una riga nel registro delle attività. Non blocca mai l'azione principale. */
export async function audit(entry: AuditEntry): Promise<void> {
	try {
		await db.insert(schema.auditLog).values({
			actorUserId: entry.actorUserId ?? null,
			action: entry.action,
			targetType: entry.targetType ?? null,
			targetId: entry.targetId === undefined ? null : String(entry.targetId),
			details: entry.details ?? null,
			ip: entry.ip ?? null
		});
	} catch (error) {
		console.error('Impossibile scrivere nel registro attività', error);
	}
}

/** Descrizioni leggibili delle azioni, per il pannello. */
export const AUDIT_LABELS: Record<string, string> = {
	'auth.register': 'Registrazione account',
	'auth.login': 'Accesso',
	'auth.login_failed': 'Accesso fallito',
	'auth.logout': 'Uscita',
	'character.create': 'Creazione personaggio',
	'character.delete': 'Cancellazione personaggio',
	'user.roles': 'Modifica ruoli di un account',
	'user.ban': 'Sospensione account',
	'user.unban': 'Fine sospensione account',
	'role.create': 'Creazione ruolo',
	'role.update': 'Modifica ruolo',
	'role.delete': 'Cancellazione ruolo',
	'settings.update': 'Modifica impostazioni',
	'map.create': 'Creazione mappa',
	'map.update': 'Modifica mappa',
	'map.delete': 'Cancellazione mappa',
	'location.create': 'Creazione luogo',
	'location.update': 'Modifica luogo',
	'location.delete': 'Cancellazione luogo',
	'chat.hide': 'Messaggio nascosto in chat',
	'chat.unhide': 'Messaggio ripristinato in chat'
};
