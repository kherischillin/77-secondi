import { describe, expect, it } from 'vitest';
import { NIGHT_CITY_DISTRICTS } from './night-city.ts';
import { boundingArea, normalizeShape } from '../../districts.ts';

describe('dati di Night City', () => {
	it('24 distretti e 156 luoghi, con nomi unici', () => {
		expect(NIGHT_CITY_DISTRICTS).toHaveLength(24);
		expect(new Set(NIGHT_CITY_DISTRICTS.map((d) => d.name)).size).toBe(24);
		expect(NIGHT_CITY_DISTRICTS.reduce((n, d) => n + d.locations.length, 0)).toBe(156);
		for (const d of NIGHT_CITY_DISTRICTS) expect(new Set(d.locations.map((l) => l.name.toLowerCase())).size, d.name).toBe(d.locations.length);
	});
	it('forme valide, area che contiene il cuore della forma, luoghi dentro il riquadro', () => {
		for (const d of NIGHT_CITY_DISTRICTS) {
			const s = normalizeShape(d.shape);
			expect(s, d.name).not.toBeNull();
			const b = boundingArea(s!.points);
			expect(d.area.x + d.area.w, d.name).toBeLessThanOrEqual(100.01);
			expect(d.area.y + d.area.h, d.name).toBeLessThanOrEqual(100.01);
			// il riquadro mostrato copre almeno metà della forma
			const ix = Math.max(0, Math.min(b.x + b.w, d.area.x + d.area.w) - Math.max(b.x, d.area.x));
			const iy = Math.max(0, Math.min(b.y + b.h, d.area.y + d.area.h) - Math.max(b.y, d.area.y));
			expect((ix * iy) / (b.w * b.h), d.name).toBeGreaterThan(0.5);
			for (const l of d.locations) {
				expect(l.x).toBeGreaterThanOrEqual(0);
				expect(l.x).toBeLessThanOrEqual(100);
				expect(l.y).toBeGreaterThanOrEqual(0);
				expect(l.y).toBeLessThanOrEqual(100);
			}
		}
	});
});
