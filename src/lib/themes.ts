/**
 * Temi grafici disponibili, tutti cyberpunk. Colori e caratteri sono in src/app.css (blocchi [data-theme=...]).
 * "nightcity" è il tema base definito in :root.
 */
export const THEMES = {
	nightcity: { label: 'Night City', description: 'Nero d’asfalto, giallo segnaletica e ciano.', swatch: ['#0a0b0f', '#fcee0a', '#00e5ff'] },
	neonrain: { label: 'Pioggia al neon', description: 'Viola profondo, insegne magenta e ciano.', swatch: ['#0c0616', '#ff2a6d', '#05d9e8'] },
	netrunner: { label: 'Netrunner', description: 'Terminale a fosfori verdi, testo da monitor.', swatch: ['#020705', '#00ff9c', '#ffb000'] }
} as const;

export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'nightcity';

export function isTheme(v: unknown): v is ThemeId {
	return typeof v === 'string' && Object.hasOwn(THEMES, v);
}
