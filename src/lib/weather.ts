/**
 * Meteo automatico e fasi lunari.
 *
 * Il tempo cambia ogni 3 ore ed è "deterministico": a parità di mappa e di ora
 * tutti i giocatori vedono lo stesso cielo, senza salvare nulla nel database.
 * Lo staff può sostituirlo a mano per un periodo (es. una tempesta durante una quest).
 */

export const CLIMATES = ['temperate', 'mediterranean', 'continental', 'arid', 'tropical', 'polar'] as const;
export type Climate = (typeof CLIMATES)[number];

export const CLIMATE_LABELS: Record<Climate, string> = {
	temperate: 'Temperato',
	mediterranean: 'Mediterraneo',
	continental: 'Continentale',
	arid: 'Arido (deserto)',
	tropical: 'Tropicale',
	polar: 'Polare'
};

export function isClimate(v: unknown): v is Climate {
	return typeof v === 'string' && (CLIMATES as readonly string[]).includes(v);
}

type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow' | 'wind' | 'sandstorm';

const CONDITIONS: Record<Condition, { label: string; icon: string; temp: number; wet?: boolean }> = {
	clear: { label: 'Sereno', icon: '☀️', temp: 1 },
	partly: { label: 'Poco nuvoloso', icon: '🌤️', temp: 0 },
	cloudy: { label: 'Nuvoloso', icon: '☁️', temp: -1 },
	fog: { label: 'Nebbia', icon: '🌫️', temp: -1 },
	drizzle: { label: 'Pioggerella', icon: '🌦️', temp: -2, wet: true },
	rain: { label: 'Pioggia', icon: '🌧️', temp: -3, wet: true },
	storm: { label: 'Temporale', icon: '⛈️', temp: -4, wet: true },
	snow: { label: 'Neve', icon: '🌨️', temp: -3 },
	wind: { label: 'Vento forte', icon: '💨', temp: -2 },
	sandstorm: { label: 'Tempesta di sabbia', icon: '🌪️', temp: 0 }
};

type Season = 0 | 1 | 2 | 3; // inverno, primavera, estate, autunno
type Weights = Partial<Record<Condition, number>>;

/** Probabilità relative di ogni condizione per clima e stagione. */
const WEIGHTS: Record<Climate, [Weights, Weights, Weights, Weights]> = {
	temperate: [
		{ clear: 2, partly: 2, cloudy: 4, fog: 2, drizzle: 2, rain: 3, snow: 2, wind: 1 },
		{ clear: 3, partly: 4, cloudy: 3, drizzle: 2, rain: 3, storm: 1, wind: 1 },
		{ clear: 6, partly: 4, cloudy: 2, rain: 1, storm: 2 },
		{ clear: 2, partly: 3, cloudy: 4, fog: 3, drizzle: 2, rain: 4, wind: 2 }
	],
	mediterranean: [
		{ clear: 4, partly: 3, cloudy: 3, drizzle: 1, rain: 3, storm: 1, wind: 2 },
		{ clear: 6, partly: 4, cloudy: 2, drizzle: 1, rain: 1, wind: 1 },
		{ clear: 10, partly: 3, cloudy: 1, storm: 1 },
		{ clear: 4, partly: 3, cloudy: 3, rain: 3, storm: 2, wind: 1 }
	],
	continental: [
		{ clear: 3, partly: 2, cloudy: 4, fog: 2, snow: 5, wind: 2 },
		{ clear: 3, partly: 4, cloudy: 3, drizzle: 2, rain: 3, wind: 1 },
		{ clear: 6, partly: 4, cloudy: 2, rain: 2, storm: 3 },
		{ clear: 2, partly: 3, cloudy: 4, fog: 3, rain: 3, snow: 1, wind: 2 }
	],
	arid: [
		{ clear: 10, partly: 3, cloudy: 1, wind: 2, sandstorm: 1 },
		{ clear: 10, partly: 2, wind: 3, sandstorm: 2 },
		{ clear: 14, partly: 1, wind: 2, sandstorm: 2 },
		{ clear: 10, partly: 2, cloudy: 1, wind: 3, sandstorm: 2 }
	],
	tropical: [
		{ clear: 5, partly: 4, cloudy: 2, drizzle: 1, rain: 1 },
		{ clear: 3, partly: 4, cloudy: 3, rain: 3, storm: 2 },
		{ clear: 2, partly: 3, cloudy: 3, drizzle: 2, rain: 5, storm: 5 },
		{ clear: 3, partly: 4, cloudy: 3, rain: 3, storm: 2 }
	],
	polar: [
		{ clear: 3, cloudy: 4, fog: 2, snow: 7, wind: 4 },
		{ clear: 3, partly: 2, cloudy: 4, snow: 5, wind: 3 },
		{ clear: 4, partly: 3, cloudy: 4, fog: 2, drizzle: 1, snow: 2, wind: 2 },
		{ clear: 2, cloudy: 4, fog: 3, snow: 6, wind: 4 }
	]
};

/** Temperatura media di giorno per clima e stagione (°C). */
const BASE_TEMP: Record<Climate, [number, number, number, number]> = {
	temperate: [4, 13, 24, 14],
	mediterranean: [11, 17, 29, 20],
	continental: [-3, 12, 25, 10],
	arid: [16, 28, 40, 30],
	tropical: [26, 28, 30, 28],
	polar: [-25, -12, 3, -10]
};

const SLOT_HOURS = 3;

/** Generatore pseudo-casuale con seme (mulberry32): stesso seme, stessi numeri. */
function random(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function seedOf(mapId: number, slot: number): number {
	return (Math.imul(mapId, 2654435761) ^ Math.imul(slot, 40503)) >>> 0;
}

function pick(weights: Weights, r: number): Condition {
	const entries = Object.entries(weights) as [Condition, number][];
	const total = entries.reduce((s, [, w]) => s + w, 0);
	let x = r * total;
	for (const [c, w] of entries) {
		if ((x -= w) < 0) return c;
	}
	return entries[entries.length - 1][0];
}

/** Stagione dell'emisfero nord in base al mese (0 = gennaio). */
export function seasonOf(month: number): Season {
	if (month === 11 || month <= 1) return 0;
	if (month <= 4) return 1;
	if (month <= 7) return 2;
	return 3;
}

/** Ora e mese locali (il ciclo giorno/notte segue il fuso del gioco). */
function localParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', month: 'numeric', hourCycle: 'h23' }).formatToParts(date);
	const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
	return { hour: get('hour'), month: get('month') - 1 };
}

export type Weather = {
	label: string;
	icon: string;
	/** Temperatura in °C; null se il meteo è stato scritto a mano dallo staff. */
	temperature: number | null;
	manual: boolean;
	moon: MoonPhase;
	night: boolean;
};

export function automaticWeather(mapId: number, climate: Climate, date: Date, timeZone = 'Europe/Rome'): Omit<Weather, 'manual' | 'moon'> {
	const slot = Math.floor(date.getTime() / (SLOT_HOURS * 3_600_000));
	// Tutto è calcolato a metà della fascia: nelle stesse 3 ore il meteo non cambia.
	const { hour, month } = localParts(new Date((slot + 0.5) * SLOT_HOURS * 3_600_000), timeZone);
	const season = seasonOf(month);
	const weights = WEIGHTS[climate][season];

	// Il tempo tende a durare: metà delle volte resta quello delle 3 ore precedenti.
	const rPrev = random(seedOf(mapId, slot - 1));
	const r = random(seedOf(mapId, slot));
	const previous = pick(weights, rPrev());
	let condition = r() < 0.5 ? previous : pick(weights, r());

	// Escursione tra giorno e notte: minimo all'alba, massimo nel primo pomeriggio.
	const diurnal = Math.round(5 * Math.cos(((hour - 15) / 24) * 2 * Math.PI));
	const noise = Math.round(r() * 6 - 3);
	let temperature = BASE_TEMP[climate][season] + diurnal + noise + CONDITIONS[condition].temp;

	// Coerenza: niente neve col caldo, niente pioggia col gelo.
	if (condition === 'snow' && temperature > 2) condition = 'rain';
	if (CONDITIONS[condition].wet && temperature < -1) condition = 'snow';
	if (condition === 'snow') temperature = Math.min(temperature, 1);

	const night = hour < 6 || hour >= 20;
	const c = CONDITIONS[condition];
	const icon = night && (condition === 'clear' || condition === 'partly') ? '🌙' : c.icon;
	return { label: night && condition === 'clear' ? 'Sereno, notte' : c.label, icon, temperature, night };
}

export type MapWeatherInput = {
	id: number;
	climate: string | null;
	weatherOverride: string | null;
	weatherOverrideUntil: Date | null;
};

/** Meteo da mostrare su una mappa e nei suoi luoghi (null = la mappa non ha meteo). */
export function weatherFor(map: MapWeatherInput, date: Date, timeZone = 'Europe/Rome'): Weather | null {
	const moon = moonPhase(date);
	if (map.weatherOverride && map.weatherOverrideUntil && map.weatherOverrideUntil > date) {
		const { hour } = localParts(date, timeZone);
		return { label: map.weatherOverride, icon: '✦', temperature: null, manual: true, moon, night: hour < 6 || hour >= 20 };
	}
	if (!isClimate(map.climate)) return null;
	return { ...automaticWeather(map.id, map.climate, date, timeZone), manual: false, moon };
}

// ---------------------------------------------------------------------------
// Fasi lunari
// ---------------------------------------------------------------------------

export type MoonPhase = { name: string; icon: string; /** 0 = nuova, 0.5 = piena */ fraction: number };

const SYNODIC_MONTH = 29.530588853;
/** Luna nuova di riferimento: 6 gennaio 2000, 18:14 UTC. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const PHASES = [
	{ name: 'Luna nuova', icon: '🌑' },
	{ name: 'Luna crescente', icon: '🌒' },
	{ name: 'Primo quarto', icon: '🌓' },
	{ name: 'Gibbosa crescente', icon: '🌔' },
	{ name: 'Luna piena', icon: '🌕' },
	{ name: 'Gibbosa calante', icon: '🌖' },
	{ name: 'Ultimo quarto', icon: '🌗' },
	{ name: 'Luna calante', icon: '🌘' }
];

export function moonPhase(date: Date): MoonPhase {
	const days = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
	const fraction = (((days / SYNODIC_MONTH) % 1) + 1) % 1;
	const index = Math.round(fraction * 8) % 8;
	return { ...PHASES[index], fraction };
}
