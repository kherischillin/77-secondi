import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from './db';
import { DEFAULT_RULES, rulesSchema, type Rules } from '../rules.ts';
import { DEFAULT_ECONOMY, economySchema, type Economy } from '../economy.ts';

/**
 * Impostazioni del sito, con valori predefiniti e validazione.
 * Sono salvate nel database (tabella settings) e modificabili dal pannello di gestione.
 */
export const settingsSchema = z.object({
	siteName: z.string().trim().min(1).max(80),
	siteTagline: z.string().trim().max(200),
	registrationsOpen: z.boolean(),
	maxCharactersPerUser: z.number().int().min(1).max(20),
	maxGuildsPerCharacter: z.number().int().min(1).max(10)
});

export type SiteSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
	siteName: 'GDR Online',
	siteTagline: 'Un gioco di ruolo testuale',
	registrationsOpen: true,
	maxCharactersPerUser: 3,
	maxGuildsPerCharacter: 2
};

let cache: SiteSettings | null = null;

export async function getSettings(): Promise<SiteSettings> {
	if (cache) return cache;
	const rows = await db.select().from(schema.settings);
	const own = Object.keys(DEFAULT_SETTINGS);
	const stored = Object.fromEntries(rows.filter((r) => own.includes(r.key)).map((r) => [r.key, r.value]));
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

// ---------------------------------------------------------------------------
// Regole numeriche (salvate nella stessa tabella, sotto la chiave "rules")
// ---------------------------------------------------------------------------


let rulesCache: Rules | null = null;

export async function getRules(): Promise<Rules> {
	if (rulesCache) return rulesCache;
	const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'rules'));
	const parsed = rulesSchema.safeParse({ ...DEFAULT_RULES, ...((row?.value as object) ?? {}) });
	rulesCache = parsed.success ? parsed.data : DEFAULT_RULES;
	return rulesCache;
}

export async function updateRules(values: Rules): Promise<void> {
	const parsed = rulesSchema.parse(values);
	await db
		.insert(schema.settings)
		.values({ key: 'rules', value: parsed })
		.onConflictDoUpdate({ target: schema.settings.key, set: { value: parsed, updatedAt: new Date() } });
	rulesCache = parsed;
}

// ---------------------------------------------------------------------------
// Economia (chiave "economy")
// ---------------------------------------------------------------------------

let economyCache: Economy | null = null;

export async function getEconomy(): Promise<Economy> {
	if (economyCache) return economyCache;
	const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'economy'));
	const parsed = economySchema.safeParse({ ...DEFAULT_ECONOMY, ...((row?.value as object) ?? {}) });
	economyCache = parsed.success ? parsed.data : DEFAULT_ECONOMY;
	return economyCache;
}

export async function updateEconomy(values: Economy): Promise<void> {
	const parsed = economySchema.parse(values);
	await db
		.insert(schema.settings)
		.values({ key: 'economy', value: parsed })
		.onConflictDoUpdate({ target: schema.settings.key, set: { value: parsed, updatedAt: new Date() } });
	economyCache = parsed;
}
