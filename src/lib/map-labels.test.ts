import { describe, expect, it } from 'vitest';
import { labelRect, placeLabels } from './map-labels.ts';

describe('placeLabels', () => {
	it('mette il nome a destra quando c\'è spazio', () => {
		expect(placeLabels([{ x: 50, y: 50, w: 80, h: 18 }], { width: 400, height: 300 })).toEqual(['right']);
	});

	it('vicino al bordo destro lo sposta a sinistra', () => {
		expect(placeLabels([{ x: 390, y: 50, w: 80, h: 18 }], { width: 400, height: 300 })).toEqual(['left']);
	});

	it('due luoghi affiancati non si coprono il nome', () => {
		const items = [
			{ x: 100, y: 100, w: 90, h: 18 },
			{ x: 150, y: 100, w: 90, h: 18 }
		];
		const sides = placeLabels(items, { width: 400, height: 300 });
		const [a, b] = items.map((it, i) => labelRect(it, sides[i]!, 10));
		const overlapX = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
		const overlapY = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
		expect(overlapX > 0 && overlapY > 0).toBe(false);
	});

	it('restituisce i lati nello stesso ordine dei luoghi, anche con le priorità', () => {
		const sides = placeLabels(
			[
				{ x: 390, y: 50, w: 80, h: 18 },
				{ x: 50, y: 50, w: 80, h: 18, priority: 5 }
			],
			{ width: 400, height: 300 }
		);
		expect(sides).toEqual(['left', 'right']);
	});

	it('se non c\'è posto il nome si nasconde (tranne i luoghi con persone)', () => {
		const items = [
			{ x: 100, y: 100, w: 90, h: 18 },
			{ x: 100, y: 100, w: 90, h: 18 },
			{ x: 100, y: 100, w: 90, h: 18 },
			{ x: 100, y: 100, w: 90, h: 18 },
			{ x: 100, y: 100, w: 90, h: 18 },
			{ x: 100, y: 100, w: 90, h: 18, priority: 1 }
		];
		const sides = placeLabels(items, { width: 400, height: 300 });
		expect(sides[5]).not.toBeNull();
		expect(sides.filter((s) => s === null).length).toBeGreaterThanOrEqual(1);
	});
});
