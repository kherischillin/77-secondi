import { describe, expect, it } from 'vitest';
import { currentScene, leadLabel, recordWindow } from './scene.ts';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 12, h, m));

describe('currentScene', () => {
	it('nessun messaggio: nessuna scena', () => {
		expect(currentScene([])).toBeNull();
	});
	it('prende la serie più recente, interrotta da una pausa oltre 2 ore', () => {
		const s = currentScene([at(9), at(10), at(14), at(15), at(15, 40), at(17, 30)]);
		expect(s).toEqual({ first: at(14), last: at(17, 30) });
	});
	it('una pausa di esattamente 2 ore non spezza la scena', () => {
		expect(currentScene([at(12), at(10)])).toEqual({ first: at(10), last: at(12) });
	});
});

describe('recordWindow', () => {
	const scene = { first: at(14), last: at(16) };
	it('parte dal primo messaggio (compreso) e finisce un\'ora dopo l\'ultimo', () => {
		const w = recordWindow(scene, 0, at(20))!;
		expect(w.from.getTime()).toBe(at(14).getTime() - 1);
		expect(w.to).toEqual(at(17));
	});
	it('si può anticipare fino a 3 ore, non oltre', () => {
		expect(recordWindow(scene, 180, at(20))!.from.getTime()).toBe(at(11).getTime() - 1);
		expect(recordWindow(scene, 181, at(20))).toBeNull();
		expect(recordWindow(scene, -30, at(20))).toBeNull();
	});
	it('non va oltre adesso', () => {
		expect(recordWindow(scene, 0, at(16, 20))!.to.getTime()).toBe(at(16, 20).getTime() + 1);
	});
});

describe('leadLabel', () => {
	it('etichette leggibili', () => {
		expect(leadLabel(0)).toBe('Dal primo messaggio del tuo personaggio');
		expect(leadLabel(30)).toBe('30 minuti prima del tuo primo messaggio');
		expect(leadLabel(60)).toBe('1 ora prima del tuo primo messaggio');
		expect(leadLabel(180)).toBe('3 ore prima del tuo primo messaggio');
	});
});
