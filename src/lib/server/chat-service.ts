import { randomInt } from 'node:crypto';
import { and, desc, eq, gt, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from './db/index.ts';
import { rollDice, type ChatMessageView, type ParsedMessage } from '../chat.ts';
import { describeCheck, type CheckResult } from '../rules.ts';
import { listPresentAt, markPosted } from './presence.ts';
import { broadcastPresence, publishMessage, publishVisibility } from './realtime.ts';
import { RateLimiter } from './rate-limit.ts';
import { fullName } from '../format.ts';

export const HISTORY_PAGE = 50;

/** Chi sta guardando la chat: serve a decidere cosa può vedere. */
export type Viewer = { characterId: number; canModerate: boolean };

const sender = alias(schema.characters, 'sender');
const recipient = alias(schema.characters, 'recipient');

function baseQuery() {
	return db
		.select({
			message: schema.chatMessages,
			senderName: sender.name,
			senderSurname: sender.surname,
			recipientName: recipient.name,
			recipientSurname: recipient.surname
		})
		.from(schema.chatMessages)
		.leftJoin(sender, eq(schema.chatMessages.characterId, sender.id))
		.leftJoin(recipient, eq(schema.chatMessages.recipientCharacterId, recipient.id));
}

type Row = Awaited<ReturnType<ReturnType<typeof baseQuery>['execute']>>[number];

function toView(r: Row): ChatMessageView {
	const m = r.message;
	return {
		id: m.id,
		kind: m.kind,
		characterId: m.characterId,
		characterName: r.senderName ? fullName({ name: r.senderName, surname: r.senderSurname }) : null,
		recipientCharacterId: m.recipientCharacterId,
		recipientName: r.recipientName ? fullName({ name: r.recipientName, surname: r.recipientSurname }) : null,
		npcName: m.npcName,
		tag: m.tag,
		body: m.body,
		meta: (m.meta as ChatMessageView['meta']) ?? null,
		createdAt: m.createdAt.toISOString(),
		hidden: m.deletedAt !== null,
		questId: m.questId
	};
}

/** Filtri di visibilità: sussurri solo ai diretti interessati, nascosti solo ai moderatori. */
function visibleTo(viewer: Viewer): SQL {
	const whisperOk = or(
		sql`${schema.chatMessages.kind} <> 'whisper'`,
		eq(schema.chatMessages.characterId, viewer.characterId),
		eq(schema.chatMessages.recipientCharacterId, viewer.characterId)
	)!;
	return viewer.canModerate ? whisperOk : and(whisperOk, isNull(schema.chatMessages.deletedAt))!;
}

/** Ultimi messaggi del luogo (o quelli prima di un certo id, per "carica precedenti"). */
export async function loadHistory(locationId: number, viewer: Viewer, beforeId?: number) {
	const rows = await baseQuery()
		.where(
			and(
				eq(schema.chatMessages.locationId, locationId),
				visibleTo(viewer),
				beforeId ? lt(schema.chatMessages.id, beforeId) : undefined
			)
		)
		.orderBy(desc(schema.chatMessages.id))
		.limit(HISTORY_PAGE + 1);
	const hasMore = rows.length > HISTORY_PAGE;
	return { messages: rows.slice(0, HISTORY_PAGE).reverse().map(toView), hasMore };
}

/** Messaggi arrivati dopo un certo id: per recuperare quelli persi durante una disconnessione. */
export async function loadSince(locationId: number, viewer: Viewer, afterId: number) {
	const rows = await baseQuery()
		.where(
			and(
				eq(schema.chatMessages.locationId, locationId),
				visibleTo(viewer),
				gt(schema.chatMessages.id, afterId)
			)
		)
		.orderBy(schema.chatMessages.id)
		.limit(200);
	return rows.map(toView);
}

async function loadOne(id: number) {
	const [row] = await baseQuery().where(eq(schema.chatMessages.id, id));
	return row ? toView(row) : null;
}

export class ChatError extends Error {}

/** Al massimo 5 messaggi ogni 10 secondi per personaggio: blocca lo spam, non il gioco. */
const postLimiter = new RateLimiter(5, 10_000);

export type Author = {
	userId: number;
	characterId: number;
	capabilities: ReadonlySet<string>;
};

/** Contesto di gioco: quest in corso e regole (il gioco libero è descrittivo). */
export type PlayContext = { questId: number | null; diceOutsideQuest: boolean };

function checkRate(characterId: number) {
	const key = String(characterId);
	if (postLimiter.isLimited(key)) throw new ChatError('Stai scrivendo troppo in fretta: aspetta qualche secondo.');
	postLimiter.hit(key);
}

async function insertAndPublish(values: typeof schema.chatMessages.$inferInsert) {
	const [inserted] = await db.insert(schema.chatMessages).values(values).returning({ id: schema.chatMessages.id });
	if (values.characterId && values.kind !== 'system') await markPosted(values.characterId);
	const view = await loadOne(inserted.id);
	if (view) publishMessage(values.locationId, view);
	// Aggiorna la turnazione ("ultima azione") nell'elenco dei presenti.
	void broadcastPresence(values.locationId);
	return view;
}

/** Registra un messaggio e lo invia a chi è nel luogo. */
export async function postMessage(locationId: number, author: Author, parsed: ParsedMessage, play: PlayContext) {
	if (parsed.kind === 'dice' && !play.questId && !play.diceOutsideQuest) {
		throw new ChatError('Fuori dalle quest il gioco è descrittivo: i tiri di dado sono disattivati.');
	}
	checkRate(author.characterId);

	let values: typeof schema.chatMessages.$inferInsert;
	const base = { locationId, characterId: author.characterId, authorUserId: author.userId, questId: play.questId };

	switch (parsed.kind) {
		case 'master':
			if (!author.capabilities.has('chat.master')) throw new ChatError('Non hai il permesso di scrivere come Master.');
			values = { ...base, kind: 'master', body: parsed.body, tag: parsed.tag };
			break;
		case 'npc':
			if (!author.capabilities.has('chat.npc')) throw new ChatError('Non hai il permesso di muovere i PNG.');
			values = { ...base, kind: 'npc', body: parsed.body, tag: parsed.tag, npcName: parsed.npcName };
			break;
		case 'whisper': {
			const present = await listPresentAt(locationId);
			const wanted = parsed.recipient.toLowerCase();
			const target = present.find(
				(p) =>
					p.characterId !== author.characterId &&
					(p.name.toLowerCase() === wanted || fullName(p).toLowerCase() === wanted)
			);
			if (!target) throw new ChatError(`${parsed.recipient} non è presente in questo luogo.`);
			values = { ...base, kind: 'whisper', body: parsed.body, recipientCharacterId: target.characterId };
			break;
		}
		case 'dice': {
			const result = rollDice(parsed.roll, (min, max) => randomInt(min, max + 1));
			values = {
				...base,
				kind: 'dice',
				tag: parsed.tag,
				body: `${result.expression}: ${result.rolls.join(' + ')}${result.modifier ? ` (${result.modifier > 0 ? '+' : ''}${result.modifier})` : ''} = ${result.total}`,
				meta: { dice: result }
			};
			break;
		}
		default:
			values = { ...base, kind: 'action', body: parsed.body, tag: parsed.tag };
	}

	return insertAndPublish(values);
}

/** Prova di abilità o caratteristica (solo in quest). Il risultato è calcolato dal server. */
export async function postCheck(locationId: number, author: Author, questId: number, check: CheckResult) {
	checkRate(author.characterId);
	return insertAndPublish({
		locationId,
		characterId: author.characterId,
		authorUserId: author.userId,
		questId,
		kind: 'check',
		body: describeCheck(check),
		meta: { check }
	});
}

/** Messaggio di sistema nel luogo (inizio e fine quest...). */
export async function postSystem(locationId: number, body: string, questId: number | null, characterId: number | null = null) {
	return insertAndPublish({ locationId, characterId, kind: 'system', body, questId });
}

/** Moderazione: nasconde o ripristina un messaggio. */
export async function setHidden(messageId: number, moderatorUserId: number, hidden: boolean) {
	const [row] = await db
		.update(schema.chatMessages)
		.set(hidden ? { deletedAt: new Date(), deletedByUserId: moderatorUserId } : { deletedAt: null, deletedByUserId: null })
		.where(eq(schema.chatMessages.id, messageId))
		.returning({ locationId: schema.chatMessages.locationId });
	if (!row) return null;
	const view = await loadOne(messageId);
	if (view) publishVisibility(row.locationId, view);
	return view;
}

/**
 * Tutti i messaggi di un luogo in un intervallo di tempo, oppure di una quest.
 * Usato per registrare le giocate: i filtri (sussurri, nascosti) si applicano dopo.
 */
export async function loadRange(locationId: number, range: { from: Date; to: Date } | { questId: number }) {
	const rows = await baseQuery()
		.where(
			and(
				eq(schema.chatMessages.locationId, locationId),
				'questId' in range
					? eq(schema.chatMessages.questId, range.questId)
					: and(gt(schema.chatMessages.createdAt, range.from), lt(schema.chatMessages.createdAt, range.to))
			)
		)
		.orderBy(schema.chatMessages.id)
		.limit(3000);
	return rows.map(toView);
}

/** Un singolo messaggio con il nome del luogo (per le segnalazioni). */
export async function getMessageWithLocation(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const view = await loadOne(id);
	if (!view) return null;
	const [row] = await db
		.select({ locationId: schema.locations.id, locationName: schema.locations.name })
		.from(schema.chatMessages)
		.innerJoin(schema.locations, eq(schema.chatMessages.locationId, schema.locations.id))
		.where(eq(schema.chatMessages.id, id));
	return row ? { view, ...row } : null;
}
