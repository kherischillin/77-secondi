import type { ChatMessageView } from '../chat.ts';
import { listPresentAt } from './presence.ts';

/**
 * Smistamento in tempo reale dei messaggi.
 *
 * Ogni browser aperto su una chat è un "iscritto" al canale di quel luogo.
 * Quando succede qualcosa (nuovo messaggio, qualcuno entra o esce...) il server
 * lo spinge a tutti gli iscritti, rispettando chi può vedere cosa (es. i sussurri).
 *
 * Funziona in memoria su un singolo server. Se un giorno il gioco girerà su più server,
 * basterà far passare questi eventi da Redis senza cambiare il resto.
 */

export type Subscriber = {
	characterId: number;
	canModerate: boolean;
	send: (event: string, data: unknown, id?: number) => void;
};

const channels = new Map<number, Set<Subscriber>>();

export function subscribe(locationId: number, subscriber: Subscriber): () => void {
	let set = channels.get(locationId);
	if (!set) channels.set(locationId, (set = new Set()));
	set.add(subscriber);
	return () => {
		set.delete(subscriber);
		if (set.size === 0) channels.delete(locationId);
	};
}

/** Quante connessioni ha aperto questo personaggio su questo luogo (più schede, ecc.). */
export function connectionsOf(locationId: number, characterId: number): number {
	let n = 0;
	for (const s of channels.get(locationId) ?? []) if (s.characterId === characterId) n++;
	return n;
}

/** Chi può vedere un messaggio: i sussurri solo mittente e destinatario. */
export function canSee(message: Pick<ChatMessageView, 'kind' | 'characterId' | 'recipientCharacterId'>, characterId: number) {
	if (message.kind !== 'whisper') return true;
	return message.characterId === characterId || message.recipientCharacterId === characterId;
}

export function publishMessage(locationId: number, message: ChatMessageView) {
	for (const s of channels.get(locationId) ?? []) {
		if (canSee(message, s.characterId)) s.send('message', message, message.id);
	}
}

/** Un messaggio è stato nascosto o ripristinato da un moderatore. */
export function publishVisibility(locationId: number, message: ChatMessageView) {
	for (const s of channels.get(locationId) ?? []) {
		if (!canSee(message, s.characterId)) continue;
		if (s.canModerate) s.send('update', message);
		else if (message.hidden) s.send('remove', { id: message.id });
		else s.send('message', message);
	}
}

/** Aggiorna l'elenco dei presenti per tutti quelli che sono nel luogo. */
export async function broadcastPresence(locationId: number) {
	const set = channels.get(locationId);
	if (!set || set.size === 0) return;
	const present = await listPresentAt(locationId);
	for (const s of set) s.send('presence', present);
}

/** Il luogo è stato modificato (descrizione, nome) o eliminato: i browser ricaricano i dati. */
export function broadcastLocationChanged(locationId: number) {
	for (const s of channels.get(locationId) ?? []) s.send('location', { id: locationId });
}

/** Una quest è iniziata o finita nel luogo: i browser ricaricano lo stato (avviso, strumenti numerici). */
export function broadcastQuestChanged(locationId: number) {
	for (const s of channels.get(locationId) ?? []) s.send('quest', { locationId });
}
