import { describe, expect, it } from 'vitest';
import { automaticWeather, CLIMATES, moonPhase, seasonOf, weatherFor } from './weather.ts';

describe('meteo', () => {
	it('stagioni', () => {
		expect(seasonOf(0)).toBe(0);
		expect(seasonOf(3)).toBe(1);
		expect(seasonOf(6)).toBe(2);
		expect(seasonOf(9)).toBe(3);
		expect(seasonOf(11)).toBe(0);
	});

	it('uguale per tutti nella stessa fascia di 3 ore', () => {
		const a = automaticWeather(1, 'temperate', new Date('2026-11-12T09:05:00Z'));
		const b = automaticWeather(1, 'temperate', new Date('2026-11-12T10:55:00Z'));
		expect(a).toEqual(b);
	});

	it('mappe diverse possono avere cieli diversi', () => {
		const labels = new Set<string>();
		for (let id = 1; id <= 30; id++) labels.add(automaticWeather(id, 'temperate', new Date('2026-04-12T12:00:00Z')).label);
		expect(labels.size).toBeGreaterThan(1);
	});

	it('coerenza temperatura/precipitazioni su un anno intero', () => {
		const start = Date.UTC(2026, 0, 1);
		for (const climate of CLIMATES) {
			for (let h = 0; h < 24 * 365; h += 3) {
				const w = automaticWeather(7, climate, new Date(start + h * 3_600_000));
				if (w.label === 'Neve') expect(w.temperature).toBeLessThanOrEqual(1);
				if (['Pioggia', 'Pioggerella', 'Temporale'].includes(w.label)) expect(w.temperature).toBeGreaterThanOrEqual(-1);
				if (w.label === 'Tempesta di sabbia') expect(climate).toBe('arid');
			}
		}
	});

	it('il deserto d’estate è caldo, il polo d’inverno gela', () => {
		const july = new Date('2026-07-15T13:00:00Z');
		const jan = new Date('2026-01-15T13:00:00Z');
		expect(automaticWeather(3, 'arid', july).temperature).toBeGreaterThan(30);
		expect(automaticWeather(3, 'polar', jan).temperature).toBeLessThan(-10);
	});

	it('meteo manuale dello staff finché non scade', () => {
		const now = new Date('2026-11-12T12:00:00Z');
		const map = { id: 1, climate: 'temperate', weatherOverride: 'Pioggia acida', weatherOverrideUntil: new Date('2026-11-12T15:00:00Z') };
		expect(weatherFor(map, now)?.label).toBe('Pioggia acida');
		expect(weatherFor(map, now)?.manual).toBe(true);
		expect(weatherFor(map, new Date('2026-11-12T16:00:00Z'))?.manual).toBe(false);
	});

	it('senza clima niente meteo', () => {
		expect(weatherFor({ id: 1, climate: null, weatherOverride: null, weatherOverrideUntil: null }, new Date())).toBeNull();
	});
});

describe('luna', () => {
	it('fasi note', () => {
		// Luna piena del 5 novembre 2025, luna nuova del 20 novembre 2025.
		expect(moonPhase(new Date('2025-11-05T13:19:00Z')).name).toBe('Luna piena');
		expect(moonPhase(new Date('2025-11-20T06:47:00Z')).name).toBe('Luna nuova');
	});
});
