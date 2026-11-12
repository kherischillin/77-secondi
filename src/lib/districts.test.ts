import { describe, expect, it } from 'vitest';
import { areaFromPoints, normalizeArea, wouldCycle, zoomTransform } from './districts.ts';

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
