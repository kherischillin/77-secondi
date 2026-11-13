/**
 * Dove mettere il nome di ogni luogo accanto al suo puntino, perché i nomi non si coprano a vicenda:
 * per ogni luogo si prova a destra, a sinistra, sotto e sopra, e si sceglie il lato con meno sovrapposizioni
 * (con i nomi già sistemati, con gli altri puntini e con i bordi della mappa). Calcolo puro, in pixel.
 */

export type LabelSide = 'right' | 'left' | 'below' | 'above';
export type LabelItem = { x: number; y: number; w: number; h: number; priority?: number };
type Rect = [number, number, number, number];

const SIDES: LabelSide[] = ['right', 'left', 'below', 'above'];

export function labelRect(item: LabelItem, side: LabelSide, gap: number): Rect {
	const { x, y, w, h } = item;
	if (side === 'right') return [x + gap, y - h / 2, w, h];
	if (side === 'left') return [x - gap - w, y - h / 2, w, h];
	if (side === 'below') return [x - w / 2, y + gap, w, h];
	return [x - w / 2, y - gap - h, w, h];
}

function overlap(a: Rect, b: Rect) {
	const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
	const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
	return w > 0 && h > 0 ? w * h : 0;
}

function outside(r: Rect, width: number, height: number) {
	return r[2] * r[3] - overlap(r, [0, 0, width, height]);
}

/**
 * Lato scelto per ciascun luogo, nello stesso ordine. Prima si sistemano quelli con `priority` più alta.
 * Se in nessun lato il nome sta senza coprire buona parte di altri nomi (mappa piccola, es. telefono),
 * il risultato è null: quel nome compare solo passandoci sopra. I luoghi con priorità restano sempre visibili.
 */
export function placeLabels(items: LabelItem[], bounds: { width: number; height: number }, dot = 7, gap = 10): (LabelSide | null)[] {
	const dots: Rect[] = items.map((i) => [i.x - dot, i.y - dot, dot * 2, dot * 2]);
	const order = items.map((_, i) => i).sort((a, b) => (items[b].priority ?? 0) - (items[a].priority ?? 0) || items[a].y - items[b].y || items[a].x - items[b].x);
	const placed: Rect[] = [];
	const result: (LabelSide | null)[] = items.map(() => 'right');
	for (const i of order) {
		let best: { side: LabelSide; cost: number; rect: Rect } | null = null;
		for (const side of SIDES) {
			const rect = labelRect(items[i], side, gap);
			let cost = outside(rect, bounds.width, bounds.height) * 3;
			for (const p of placed) cost += overlap(rect, p);
			dots.forEach((d, j) => {
				if (j !== i) cost += overlap(rect, d) * 2;
			});
			if (!best || cost < best.cost - 0.01) best = { side, cost, rect };
			if (cost === 0) break;
		}
		if (best!.cost > items[i].w * items[i].h * 0.15 && !items[i].priority) {
			result[i] = null;
			continue;
		}
		result[i] = best!.side;
		placed.push(best!.rect);
	}
	return result;
}
