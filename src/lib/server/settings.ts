import { db, schema } from './db';
import { z } from 'zod';

/**
 * Impostazioni del sito, con valori predefiniti e validazione.
 * Sono salvate nel database (tabella settings) e modificabili dal pannello di gestione.
 */
export const settingsSchema = z.object({
	siteName: z.string().trim().min(1).max(80),
	siteTagline: z.string().trim().max(200),
	registrationsOpen: z.boolean(),
	maxCharactersPerUser: z.number().int().min(1).max(20)
});

export type SiteSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
	siteName: 'GDR Online',
	siteTagline: 'Un gioco di ruolo testuale',
	registrationsOpen: true,
	maxCharactersPerUser: 3
};

let cache: SiteSettings | null = null;

export async function getSettings(): Promise<SiteSettings> {
	if (cache) return cache;
	const rows = await db.select().from(schema.settings);
	const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	const merged = { ...DEFAULT_SETTINGS, ...stored };
	const parsed = settingsSchema.safeParse(merged);
	cache = parsed.success ? parsed.data : DEFAULT_SETTINGS;
	return cache;
}

export async function updateSettings(values: SiteSettings): Promise<void> {
	const parsed = settingsSchema.parse(values);
	await db.transaction(async (tx) => {
		for (const [key, value] of Object.entries(parsed)) {
			await tx
				.insert(schema.settings)
				.values({ key, value })
				.onConflictDoUpdate({
					target: schema.settings.key,
					set: { value, updatedAt: new Date() }
				});
		}
	});
	cache = parsed;
}
