/**
 * Temi grafici disponibili. I colori sono in src/app.css (blocchi [data-theme=...]).
 * "taverna" è il tema base definito in :root.
 */
export const THEMES = {
	taverna: { label: 'Taverna', description: 'Scuro e caldo, legno e candele.', swatch: ['#14110f', '#d4a24c', '#ece4d8'] },
	pergamena: { label: 'Pergamena', description: 'Chiaro, carta antica e inchiostro.', swatch: ['#efe5cf', '#8a4b12', '#2b2118'] },
	neon: { label: 'Neon', description: 'Notte metropolitana, magenta e ciano.', swatch: ['#0a0b12', '#ff3d8b', '#2ee6ff'] },
	notte: { label: 'Notte', description: 'Blu freddo e sobrio.', swatch: ['#0f141b', '#7fb2ff', '#e2e8f0'] }
} as const;

export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export function isTheme(v: unknown): v is ThemeId {
	return typeof v === 'string' && v in THEMES;
}
