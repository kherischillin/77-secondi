import { describe, expect, it } from 'vitest';
import { areaFromPoints, boundingArea, labelPoint, normalizeArea, normalizeShape, parseDistrictImport, rectPoints, wouldCycle, zoomTransform } from './districts.ts';

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
