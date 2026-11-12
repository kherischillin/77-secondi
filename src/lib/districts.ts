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

// ---------------------------------------------------------------------------
// Forme libere (poligoni)
// ---------------------------------------------------------------------------

export type Point = [number, number];
/** Forma del distretto: i vertici del poligono e, se serve, dove mettere l'etichetta. */
export type Shape = { points: Point[]; label?: Point };

const MAX_POINTS = 200;

function toPoint(p: unknown): Point | null {
	if (!Array.isArray(p) || p.length !== 2) return null;
	const [x, y] = p.map(Number);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return [round(Math.min(100, Math.max(0, x))), round(Math.min(100, Math.max(0, y)))];
}

/** Controlla una forma: almeno 3 vertici dentro l'immagine (0-100). Null se non valida. */
export function normalizeShape(raw: unknown): Shape | null {
	const obj = Array.isArray(raw) ? { points: raw } : (raw as { points?: unknown; label?: unknown } | null);
	if (!obj || !Array.isArray(obj.points) || obj.points.length < 3 || obj.points.length > MAX_POINTS) return null;
	const points = obj.points.map(toPoint);
	if (points.some((p) => p === null)) return null;
	const box = boundingArea(points as Point[]);
	if (box.w < 0.5 || box.h < 0.5) return null;
	const label = obj.label === undefined ? undefined : toPoint(obj.label);
	return label ? { points: points as Point[], label } : { points: points as Point[] };
}

/** Rettangolo che contiene la forma (usato per lo zoom e per il ritaglio). */
export function boundingArea(points: Point[]): Area {
	const xs = points.map((p) => p[0]);
	const ys = points.map((p) => p[1]);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x: round(x), y: round(y), w: round(Math.max(...xs) - x), h: round(Math.max(...ys) - y) };
}

/** Vertici di un rettangolo, per disegnare allo stesso modo distretti con e senza forma. */
export function rectPoints(a: Area): Point[] {
	return [
		[a.x, a.y],
		[a.x + a.w, a.y],
		[a.x + a.w, a.y + a.h],
		[a.x, a.y + a.h]
	];
}

/** Dove mettere l'etichetta: quella indicata, altrimenti il baricentro del poligono. */
export function labelPoint(shape: Shape): Point {
	if (shape.label) return shape.label;
	const pts = shape.points;
	let a = 0;
	let cx = 0;
	let cy = 0;
	for (let i = 0; i < pts.length; i++) {
		const [x0, y0] = pts[i];
		const [x1, y1] = pts[(i + 1) % pts.length];
		const f = x0 * y1 - x1 * y0;
		a += f;
		cx += (x0 + x1) * f;
		cy += (y0 + y1) * f;
	}
	if (Math.abs(a) < 1e-9) {
		const b = boundingArea(pts);
		return [b.x + b.w / 2, b.y + b.h / 2];
	}
	return [round(cx / (3 * a)), round(cy / (3 * a))];
}

export type DistrictImport = { name: string; description: string; shape: Shape };

/**
 * Elenco di distretti da importare (JSON): [{ "name": "Kabuki", "description": "...", "points": [[x,y], ...], "label": [x,y] }].
 * Restituisce i distretti validi e gli errori riga per riga.
 */
export function parseDistrictImport(text: string): { districts: DistrictImport[]; errors: string[] } {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { districts: [], errors: ['Il testo non è un JSON valido.'] };
	}
	const list = Array.isArray(data) ? data : Array.isArray((data as { districts?: unknown })?.districts) ? (data as { districts: unknown[] }).districts : null;
	if (!list) return { districts: [], errors: ['Serve un elenco di distretti.'] };
	const districts: DistrictImport[] = [];
	const errors: string[] = [];
	list.forEach((item, i) => {
		const it = item as { name?: unknown; description?: unknown; points?: unknown; label?: unknown };
		const name = typeof it?.name === 'string' ? it.name.trim() : '';
		if (name.length < 2 || name.length > 60) {
			errors.push(`Elemento ${i + 1}: nome mancante o troppo lungo.`);
			return;
		}
		const shape = normalizeShape({ points: it.points, label: it.label });
		if (!shape) {
			errors.push(`${name}: forma non valida (servono almeno 3 punti con coordinate da 0 a 100).`);
			return;
		}
		districts.push({ name, description: typeof it.description === 'string' ? it.description.trim().slice(0, 5000) : '', shape });
	});
	return { districts, errors };
}
