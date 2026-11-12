/**
 * Preferenze di notifica del giocatore (Impostazioni → Notifiche).
 * Salvate in `users.notify` (JSON); i valori mancanti prendono quelli predefiniti.
 */
import { z } from 'zod';

export const NOTIFY_OPTIONS = [
	{ key: 'titleCount', label: 'Numero di missive non lette nel titolo della finestra', hint: 'Es. «(2) GDR Online»: si vede anche con il gioco in un\'altra scheda del browser.' },
	{ key: 'soundMissive', label: 'Suono quando arriva una nuova missiva', hint: 'Il controllo avviene ogni 30 secondi.' },
	{ key: 'soundWhisper', label: 'Suono quando ricevi un sussurro in chat', hint: '' },
	{ key: 'soundMaster', label: 'Suono quando il Master scrive in chat', hint: 'Utile durante le quest, per non perdere la stringa del Master.' }
] as const;

export type NotifyKey = (typeof NOTIFY_OPTIONS)[number]['key'];
export type NotifyPrefs = Record<NotifyKey, boolean>;

export const DEFAULT_NOTIFY: NotifyPrefs = { titleCount: true, soundMissive: false, soundWhisper: false, soundMaster: false };

const notifySchema = z.object({
	titleCount: z.boolean(),
	soundMissive: z.boolean(),
	soundWhisper: z.boolean(),
	soundMaster: z.boolean()
});

/** Valore salvato (anche incompleto o vecchio) → preferenze complete. */
export function readNotify(stored: unknown): NotifyPrefs {
	const merged = { ...DEFAULT_NOTIFY, ...(stored && typeof stored === 'object' ? stored : {}) };
	const parsed = notifySchema.safeParse(merged);
	return parsed.success ? parsed.data : DEFAULT_NOTIFY;
}
