/**
 * Distretti: mappe "figlie" che occupano un'area rettangolare dell'immagine della mappa madre.
 * Calcoli puri (niente database), usati dal server, dalla pagina della mappa e dal pannello di gestione.
 */

/** Rettangolo in percentuale dell'immagine (0-100). */
export type Area = { x: number; y: number; w: number; h: number };

const MIN_SIZE = 2;
const round = (n: number) => Math.round(n * 100) / 100;

/** Legge e corregge un'area: dentro l'immagine e non più piccola del 2% per lato. Null se non valida. */
export function normalizeArea(raw: { x: unknown; y: unknown; w: unknown; h: unknown }): Area | null {
	const n = [raw.x, raw.y, raw.w, raw.h].map((v) => (v === '' || v === null || v === undefined ? NaN : Number(v)));
	if (n.some((v) => !Number.isFinite(v))) return null;
	let [x, y, w, h] = n;
	x = Math.min(Math.max(x, 0), 100 - MIN_SIZE);
	y = Math.min(Math.max(y, 0), 100 - MIN_SIZE);
	w = Math.min(Math.max(w, MIN_SIZE), 100 - x);
	h = Math.min(Math.max(h, MIN_SIZE), 100 - y);
	return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

/** Area da due angoli (per disegnarla trascinando sull'immagine). */
export function areaFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Area | null {
	return normalizeArea({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
}

/**
 * Trasformazione CSS per ingrandire l'immagine sull'area (animazione al clic):
 * l'area riempie il riquadro e resta centrata. Le misure sono in pixel del riquadro.
 */
export function zoomTransform(area: Area, box: { width: number; height: number }) {
	const scale = Math.min(100 / area.w, 100 / area.h);
	const cx = ((area.x + area.w / 2) / 100) * box.width;
	const cy = ((area.y + area.h / 2) / 100) * box.height;
	return { scale, tx: box.width / 2 - cx * scale, ty: box.height / 2 - cy * scale };
}

/** Vero se rendere `parentId` madre di `mapId` creerebbe un giro (una mappa dentro sé stessa). */
export function wouldCycle(mapId: number, parentId: number, parentOf: ReadonlyMap<number, number | null>): boolean {
	let current: number | null = parentId;
	for (let i = 0; current !== null && i < 100; i++) {
		if (current === mapId) return true;
		current = parentOf.get(current) ?? null;
	}
	return false;
}
