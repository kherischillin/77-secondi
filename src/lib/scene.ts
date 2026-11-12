/**
 * Scene e finestra di registrazione delle giocate (funzioni pure, testate).
 *
 * La "scena" di un personaggio in un luogo è la sua serie più recente di messaggi senza pause
 * più lunghe di SCENE_GAP_MINUTES. La giocata parte dal primo messaggio di quella serie, anticipata
 * al massimo di MAX_LEAD_MINUTES (per includere l'apertura scritta da altri), e finisce poco dopo
 * l'ultimo messaggio del personaggio (per includere le risposte e la chiusura).
 */

/** Una pausa più lunga di questa (senza scrivere) chiude la scena del personaggio. */
export const SCENE_GAP_MINUTES = 120;
/** Di quanto si può anticipare l'inizio rispetto al primo messaggio del personaggio. */
export const MAX_LEAD_MINUTES = 180;
/** Quanto si registra dopo l'ultimo messaggio del personaggio. */
export const TAIL_MINUTES = 60;
/** Scelte offerte nel modulo "Registra la giocata". */
export const LEAD_OPTIONS = [0, 30, 60, 120, 180] as const;

const MIN = 60_000;

export type Scene = { first: Date; last: Date };

/**
 * Scena più recente a partire dagli orari dei messaggi del personaggio (in qualsiasi ordine).
 * Null se il personaggio non ha scritto nulla.
 */
export function currentScene(times: Date[], gapMinutes = SCENE_GAP_MINUTES): Scene | null {
	if (!times.length) return null;
	const sorted = [...times].sort((a, b) => b.getTime() - a.getTime());
	const last = sorted[0];
	let first = sorted[0];
	for (const t of sorted.slice(1)) {
		if (first.getTime() - t.getTime() > gapMinutes * MIN) break;
		first = t;
	}
	return { first, last };
}

/** Intervallo da registrare: `lead` minuti prima del primo messaggio (massimo 3 ore), fino a poco dopo l'ultimo. */
export function recordWindow(scene: Scene, leadMinutes: number, now = new Date()): { from: Date; to: Date } | null {
	if (!Number.isInteger(leadMinutes) || leadMinutes < 0 || leadMinutes > MAX_LEAD_MINUTES) return null;
	const from = new Date(scene.first.getTime() - leadMinutes * MIN);
	// `from` è escluso dalla ricerca: un millisecondo prima, così il primo messaggio è compreso.
	from.setTime(from.getTime() - 1);
	const to = new Date(Math.min(now.getTime() + 1, scene.last.getTime() + TAIL_MINUTES * MIN));
	return { from, to };
}

/** Etichetta della scelta nel modulo. */
export function leadLabel(minutes: number): string {
	if (minutes === 0) return 'Dal primo messaggio del tuo personaggio';
	if (minutes < 60) return `${minutes} minuti prima del tuo primo messaggio`;
	const h = minutes / 60;
	return `${h === 1 ? '1 ora' : `${h} ore`} prima del tuo primo messaggio`;
}
