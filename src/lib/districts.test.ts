import { describe, expect, it } from 'vitest';
import { areaFromPoints, boundingArea, labelPoint, normalizeArea, normalizeShape, parseDistrictImport, rectPoints, pointInPolygon, spreadPoints, wouldCycle, zoomTransform, fitView, toFrame, fromFrame, cropToImage, imageToCrop, FULL_VIEW } from './districts.ts';

describe('distretti', () => {
	it("tiene l'area dentro l'immagine", () => {
		expect(normalizeArea({ x: 10, y: 20, w: 30, h: 40 })).toEqual({ x: 10, y: 20, w: 30, h: 40 });
		expect(normalizeArea({ x: 90, y: -5, w: 30, h: 0.5 })).toEqual({ x: 90, y: 0, w: 10, h: 2 });
		expect(normalizeArea({ x: '', y: 1, w: 1, h: 1 })).toBeNull();
	});
	it("disegna l'area da due angoli in qualsiasi ordine", () => {
		expect(areaFromPoints({ x: 60, y: 70 }, { x: 20, y: 30 })).toEqual({ x: 20, y: 30, w: 40, h: 40 });
	});
	it("lo zoom porta l'area al centro del riquadro", () => {
		const t = zoomTransform({ x: 50, y: 50, w: 25, h: 25 }, { width: 800, height: 600 });
		expect(t.scale).toBe(4);
		// Il centro dell'area (62,5%) finisce al centro del riquadro.
		expect(0.625 * 800 * t.scale + t.tx).toBeCloseTo(400);
		expect(0.625 * 600 * t.scale + t.ty).toBeCloseTo(300);
	});
	it('impedisce una mappa dentro sé stessa', () => {
		const parents = new Map<number, number | null>([[1, null], [2, 1], [3, 2]]);
		expect(wouldCycle(1, 3, parents)).toBe(true);
		expect(wouldCycle(1, 1, parents)).toBe(true);
		expect(wouldCycle(3, 1, parents)).toBe(false);
	});
});

describe('forme libere', () => {
	it('accetta un poligono e ne calcola il rettangolo', () => {
		const s = normalizeShape({ points: [[10, 10], [30, 12], [25, 40], [8, 30]] });
		expect(s).not.toBeNull();
		expect(boundingArea(s!.points)).toEqual({ x: 8, y: 10, w: 22, h: 30 });
	});
	it('rifiuta forme con meno di 3 punti o coordinate non numeriche', () => {
		expect(normalizeShape({ points: [[1, 1], [2, 2]] })).toBeNull();
		expect(normalizeShape({ points: [[1, 1], [2, 'x'], [3, 3]] })).toBeNull();
	});
	it("l'etichetta va nel baricentro, se non indicata", () => {
		expect(labelPoint({ points: [[0, 0], [10, 0], [10, 10], [0, 10]] })).toEqual([5, 5]);
		expect(labelPoint({ points: [[0, 0], [10, 0], [10, 10]], label: [2, 3] })).toEqual([2, 3]);
	});
	it('importa un elenco JSON segnalando gli elementi sbagliati', () => {
		const r = parseDistrictImport(
			JSON.stringify([
				{ name: 'Kabuki', points: [[46, 29.5], [50.5, 29.5], [49.5, 36], [46, 36]] },
				{ name: 'X', points: [[1, 1], [2, 2], [3, 1]] },
				{ name: 'Senza forma' }
			])
		);
		expect(r.districts.map((d) => d.name)).toEqual(['Kabuki']);
		expect(r.errors).toHaveLength(2);
		expect(parseDistrictImport('non json').errors[0]).toMatch(/JSON/);
	});
	it('un rettangolo diventa un poligono di 4 vertici', () => {
		expect(rectPoints({ x: 1, y: 2, w: 3, h: 4 })).toEqual([[1, 2], [4, 2], [4, 6], [1, 6]]);
	});
});

describe('spreadPoints', () => {
	const square = { points: [[10, 10], [30, 10], [30, 30], [10, 30]] as [number, number][] };
	const triangle = { points: [[0, 0], [40, 0], [0, 40]] as [number, number][] };
	it('mette i luoghi dentro la forma, in coordinate del riquadro', () => {
		const pts = spreadPoints(triangle, 5);
		expect(pts).toHaveLength(5);
		for (const [x, y] of pts) expect(x + y).toBeLessThanOrEqual(100);
	});
	it('li tiene lontani tra loro e da quelli già presenti', () => {
		const [a, b] = spreadPoints(square, 2, [[50, 50]]);
		expect(Math.hypot(a[0] - 50, a[1] - 50)).toBeGreaterThan(30);
		expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(30);
	});
	it('è deterministico', () => {
		expect(spreadPoints(square, 3)).toEqual(spreadPoints(square, 3));
	});
});

describe('pointInPolygon', () => {
	it('dentro e fuori', () => {
		const t: [number, number][] = [[0, 0], [10, 0], [0, 10]];
		expect(pointInPolygon([2, 2], t)).toBe(true);
		expect(pointInPolygon([8, 8], t)).toBe(false);
	});
});

describe('inquadratura della mappa', () => {
	it('l\'area inquadrata riempie il riquadro, centrata', () => {
		const v = fitView({ x: 20, y: 40, w: 50, h: 25 });
		expect(v.s).toBe(2);
		expect(toFrame(v, 20, 52.5)).toEqual([0, 50]);
		expect(toFrame(v, 70, 52.5)).toEqual([100, 50]);
		expect(toFrame(v, 45, 40)[1]).toBeCloseTo(25);
	});

	it('fromFrame è l\'inverso di toFrame', () => {
		const v = fitView({ x: 10, y: 10, w: 30, h: 60 });
		const [x, y] = fromFrame(v, ...toFrame(v, 33, 44));
		expect(x).toBeCloseTo(33);
		expect(y).toBeCloseTo(44);
		expect(toFrame(FULL_VIEW, 12, 34)).toEqual([12, 34]);
	});

	it('converte tra coordinate del ritaglio e dell\'immagine intera', () => {
		const crop = { x: 20, y: 40, w: 50, h: 25 };
		expect(cropToImage(crop, 50, 50)).toEqual([45, 52.5]);
		expect(imageToCrop(crop, 45, 52.5)).toEqual([50, 50]);
		expect(imageToCrop(crop, 10, 52.5)).toBeNull();
		expect(cropToImage(null, 5, 6)).toEqual([5, 6]);
	});
});
