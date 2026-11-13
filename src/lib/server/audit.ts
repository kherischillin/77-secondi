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
	'location.move': 'Spostamento luoghi sulla mappa',
	'location.delete': 'Cancellazione luogo',
	'chat.hide': 'Messaggio nascosto in chat',
	'chat.unhide': 'Messaggio ripristinato in chat',
	'quest.start': 'Inizio quest',
	'quest.end': 'Fine quest',
	'xp.award': 'Assegnazione PX',
	'sheet.update': 'Modifica scheda',
	'sheet.allocate': 'Distribuzione punti iniziali',
	'sheet.raise': 'Avanzamento con PX',
	'sheet.staff_set': 'Correzione valori della scheda (staff)',
	'sheet.reset': 'Azzeramento distribuzione (staff)',
	'map.district': 'Distretto impostato',
	'world.seed': 'Distretti e luoghi creati automaticamente',
	'sheet.redo': 'Distribuzione iniziale rifatta dal giocatore',
	'rules.update': 'Modifica regole di gioco',
	'stat.create': 'Creazione caratteristica',
	'stat.update': 'Modifica caratteristica',
	'stat.delete': 'Cancellazione caratteristica',
	'skill.create': 'Creazione abilità',
	'skill.update': 'Modifica abilità',
	'skill.delete': 'Cancellazione abilità',
	'guild.create': 'Creazione gilda',
	'guild.update': 'Modifica gilda',
	'guild.join': 'Ingresso in gilda',
	'guild.apply': 'Candidatura a una gilda',
	'guild.accept': 'Candidatura accettata',
	'guild.reject': 'Candidatura rifiutata',
	'guild.add': 'Membro aggiunto alla gilda',
	'guild.rank': 'Cambio di grado in gilda',
	'guild.expel': 'Espulsione dalla gilda',
	'guild.leave': 'Uscita dalla gilda',
	'board.create': 'Creazione bacheca',
	'board.update': 'Modifica bacheca',
	'board.delete': 'Cancellazione bacheca',
	'board.moderate': 'Moderazione bacheca',
	'esito.create': 'Richiesta di esito',
	'esito.reply': 'Risposta a un esito',
	'esito.assign': 'Esito preso in carico o lasciato',
	'esito.close': 'Esito chiuso',
	'esito.reopen': 'Esito riaperto',
	'giocata.create': 'Registrazione giocata',
	'giocata.review_request': 'Giocata inviata ai Master',
	'giocata.review': 'Revisione giocata',
	'giocata.delete': 'Cancellazione giocata',
	'report.create': 'Segnalazione allo staff',
	'report.take': 'Segnalazione presa in carico',
	'report.close': 'Segnalazione chiusa',
	'item.create': 'Creazione oggetto',
	'item.update': 'Modifica oggetto',
	'item.delete': 'Cancellazione oggetto',
	'item.give': 'Oggetto consegnato a un personaggio',
	'item.confiscate': 'Oggetto tolto a un personaggio',
	'item.handover': 'Oggetto ceduto tra personaggi',
	'market.buy': 'Acquisto al mercato',
	'market.sell': 'Vendita al mercato',
	'shop.create': 'Creazione negozio',
	'shop.update': 'Modifica negozio',
	'shop.delete': 'Cancellazione negozio',
	'money.transfer': 'Bonifico',
	'money.staff': 'Correzione del denaro (staff)',
	'economy.update': 'Modifica impostazioni economiche',
	'economy.salary': 'Modifica stipendio di un grado',
	'job.create': 'Creazione lavoro',
	'job.update': 'Modifica lavoro',
	'job.delete': 'Cancellazione lavoro',
	'room.book': 'Prenotazione stanza privata',
	'map.weather': 'Meteo impostato dallo staff',
	'page.create': 'Creazione pagina',
	'page.update': 'Modifica pagina',
	'page.delete': 'Cancellazione pagina',
	'account.theme': 'Cambio del tema grafico',
	'account.email': 'Cambio dell’email',
	'import.gdrcd': 'Importazione da GDRCD'
};
