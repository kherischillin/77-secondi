import { z } from 'zod';

/**
 * Pagina iniziale: testi del riquadro di benvenuto e immagine di sfondo (impostazioni sotto la chiave "home")
 * e modulo delle news. Funzioni pure, usate dal server e dal pannello di gestione.
 */

export const homeSchema = z.object({
	/** Riga sopra il nome del sito (es. il capitolo della trama in corso). */
	chapter: z.string().trim().max(100),
	welcomeTitle: z.string().trim().max(60),
	welcomeText: z.string().trim().max(1500),
	/** Frase sotto il numero dei presenti. */
	presentLine: z.string().trim().max(80),
	/** Immagine di sfondo caricata dallo staff (nome del file); null = disegno predefinito della città. */
	background: z.string().nullable()
});
export type HomeSettings = z.infer<typeof homeSchema>;

export const DEFAULT_HOME: HomeSettings = {
	chapter: 'Night City · aprile 2081',
	welcomeTitle: 'Benvenuto, Portatore',
	welcomeText:
		'La notte del 9 marzo 2081 la rete di Night City si è spenta per 77 secondi. Quando è tornata, migliaia di persone si sono svegliate con un ricordo che non è loro: la strada li chiama Echi, e chi ne porta uno è un Portatore.\n\nCrea il tuo personaggio, scegli da che parte stare e scopri di chi è la voce che senti.',
	presentLine: 'Vieni a giocare con noi…',
	background: null
};

export const newsFormSchema = z.object({
	title: z.string().trim().min(3, 'Il titolo deve avere almeno 3 caratteri.').max(80, 'Il titolo può avere al massimo 80 caratteri.'),
	summary: z.string().trim().max(160, 'La riga breve può avere al massimo 160 caratteri.'),
	body: z.string().trim().max(10_000, 'Il testo è troppo lungo (massimo 10.000 caratteri).'),
	isPublished: z.boolean(),
	isPinned: z.boolean()
});
export type NewsForm = z.infer<typeof newsFormSchema>;

export function readNewsForm(form: FormData) {
	return newsFormSchema.safeParse({
		title: String(form.get('title') ?? ''),
		summary: String(form.get('summary') ?? ''),
		body: String(form.get('body') ?? ''),
		isPublished: form.get('isPublished') === 'on',
		isPinned: form.get('isPinned') === 'on'
	});
}

/** Ordine del pannello: prima quelle in evidenza, poi dalla più recente. */
export function sortNews<T extends { isPinned: boolean; createdAt: string | Date; id: number }>(list: T[]): T[] {
	return [...list].sort(
		(a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id
	);
}
