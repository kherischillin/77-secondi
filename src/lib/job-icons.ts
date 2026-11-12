/**
 * Icone dei lavori liberi: piccoli disegni a linee su una griglia 24×24, colorati con il colore
 * del testo (quindi seguono il tema). Ogni icona è un elenco di forme semplici: niente HTML.
 * Per aggiungerne una basta una nuova voce qui; si sceglie poi in Gestione → Lavori.
 */

export type IconShape = { d: string } | { cx: number; cy: number; r: number } | { x: number; y: number; w: number; h: number; rx?: number };

export const JOB_ICONS = {
	briefcase: {
		label: 'Valigetta',
		shapes: [{ x: 3, y: 7, w: 18, h: 13, rx: 2 }, { d: 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }, { d: 'M3 13h18' }]
	},
	package: {
		label: 'Pacco',
		shapes: [{ d: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z' }, { d: 'M3 7.5 12 12l9-4.5' }, { d: 'M12 12v9' }, { d: 'M7.5 5.25l9 4.5' }]
	},
	cocktail: {
		label: 'Bicchiere',
		shapes: [{ d: 'M4 4h16l-8 9z' }, { d: 'M12 13v7' }, { d: 'M8 20h8' }, { d: 'M15 7l4-5' }]
	},
	car: {
		label: 'Auto',
		shapes: [
			{ d: 'M3 17v-4l2.2-5.2A2 2 0 0 1 7 6.5h10a2 2 0 0 1 1.8 1.3L21 13v4z' },
			{ d: 'M3 13h18' },
			{ cx: 7.5, cy: 17.5, r: 1.8 },
			{ cx: 16.5, cy: 17.5, r: 1.8 },
			{ d: 'M10 6.5V4h4v2.5' }
		]
	},
	stall: {
		label: 'Bancarella',
		shapes: [{ d: 'M3 9l1.5-5h15L21 9z' }, { d: 'M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0' }, { d: 'M5 12v9M19 12v9' }, { d: 'M3 21h18' }]
	},
	wrench: {
		label: 'Chiave inglese',
		shapes: [
			{
				d: 'M15 3.5a4.5 4.5 0 0 0-4.2 6.1L3.5 16.9a1.8 1.8 0 0 0 2.6 2.6l7.3-7.3A4.5 4.5 0 0 0 20 8.5l-2.8 2.8-3-.5-.5-3L16.5 5A4.5 4.5 0 0 0 15 3.5z'
			}
		]
	},
	chip: {
		label: 'Circuito',
		shapes: [
			{ x: 6.5, y: 6.5, w: 11, h: 11, rx: 1.5 },
			{ x: 10, y: 10, w: 4, h: 4 },
			{
				d: 'M10 3v3.5M14 3v3.5M10 17.5V21M14 17.5V21M3 10h3.5M3 14h3.5M17.5 10H21M17.5 14H21'
			}
		]
	},
	medical: {
		label: 'Croce medica',
		shapes: [{ d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' }]
	},
	shield: {
		label: 'Scudo',
		shapes: [{ d: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z' }, { d: 'M9 12l2 2 4-4' }]
	},
	anchor: {
		label: 'Ancora',
		shapes: [{ cx: 12, cy: 5, r: 2 }, { d: 'M12 7v14' }, { d: 'M8 10h8' }, { d: 'M4 13a8 8 0 0 0 16 0' }]
	},
	broom: {
		label: 'Scopa',
		shapes: [{ d: 'M20 3l-7.5 7.5' }, { d: 'M12.5 10.5l2 2L11 21l-8-8z' }, { d: 'M6.5 16.5l-2 2M9 19l-1.5 1.5' }]
	},
	scrap: {
		label: 'Bullone',
		shapes: [{ d: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z' }, { cx: 12, cy: 12, r: 3 }]
	},
	music: {
		label: 'Nota musicale',
		shapes: [{ d: 'M9 18V5l11-2v13' }, { cx: 6, cy: 18, r: 3 }, { cx: 17, cy: 16, r: 3 }]
	},
	laptop: {
		label: 'Portatile',
		shapes: [{ x: 4, y: 5, w: 16, h: 11, rx: 1.5 }, { d: 'M2 20h20' }]
	},
	camera: {
		label: 'Fotocamera',
		shapes: [{ x: 3, y: 7, w: 18, h: 13, rx: 2 }, { cx: 12, cy: 13.5, r: 3.5 }, { d: 'M8 7l1.5-3h5L16 7' }]
	},
	cutlery: {
		label: 'Posate',
		shapes: [{ d: 'M6 3v6a2 2 0 0 0 4 0V3' }, { d: 'M8 11v10' }, { d: 'M17 3c-2.5 2-2.5 7 0 8v10' }]
	},
	pen: {
		label: 'Penna',
		shapes: [{ d: 'M4 20l1-4L16 5l3 3L8 19z' }, { d: 'M14 7l3 3' }]
	}
} satisfies Record<string, { label: string; shapes: IconShape[] }>;

export type JobIconKey = keyof typeof JOB_ICONS;
export const JOB_ICON_KEYS = Object.keys(JOB_ICONS) as JobIconKey[];
export const DEFAULT_JOB_ICON: JobIconKey = 'briefcase';

export function isJobIcon(v: unknown): v is JobIconKey {
	return typeof v === 'string' && Object.hasOwn(JOB_ICONS, v);
}

/** Forme dell'icona; per un nome sconosciuto (es. icona tolta dall'elenco) usa la valigetta. */
export function jobIconShapes(key: string | null | undefined): IconShape[] {
	return JOB_ICONS[isJobIcon(key) ? key : DEFAULT_JOB_ICON].shapes;
}
