/**
 * Dati anagrafici della scheda: brevi campi di testo libero, mostrati accanto al nome.
 * L'occupazione non è qui: la compila il gioco dal lavoro scelto in Uffici → Lavori.
 * Per aggiungere, togliere o riordinare un campo basta modificare questo elenco:
 * i valori stanno in `characters.profile` (JSON), quindi non serve toccare il database.
 */
import { z } from 'zod';

export const PROFILE_FIELDS = [
	{ key: 'age', label: 'Età', placeholder: 'es. 34 anni' },
	{ key: 'birthDate', label: 'Data di nascita', placeholder: 'es. 12 marzo 2043' },
	{ key: 'birthPlace', label: 'Luogo di nascita', placeholder: 'es. Night City, Watson' },
	{ key: 'height', label: 'Altezza', placeholder: 'es. 1,82 m' },
	{ key: 'weight', label: 'Peso', placeholder: 'es. 78 kg' },
	{ key: 'eyes', label: 'Occhi', placeholder: 'es. grigi, impianti ottici Kiroshi' },
	{ key: 'hair', label: 'Capelli', placeholder: 'es. neri, rasati ai lati' }
] as const;

export type ProfileKey = (typeof PROFILE_FIELDS)[number]['key'];
export type Profile = Partial<Record<ProfileKey, string>>;

export const PROFILE_MAX = 60;

export const profileSchema = z.object(
	Object.fromEntries(
		PROFILE_FIELDS.map((f) => [
			f.key,
			z
				.string()
				.trim()
				.max(PROFILE_MAX, `${f.label}: al massimo ${PROFILE_MAX} caratteri.`)
				.transform((s) => s.replace(/\s+/g, ' '))
		])
	) as unknown as Record<ProfileKey, z.ZodType<string, string>>
);

/** Legge i campi dal modulo; restituisce solo quelli compilati. */
export function readProfile(form: FormData) {
	const parsed = profileSchema.safeParse(Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, String(form.get(`profile_${f.key}`) ?? '')])));
	if (!parsed.success) return parsed;
	const data: Profile = {};
	for (const f of PROFILE_FIELDS) if (parsed.data[f.key]) data[f.key] = parsed.data[f.key];
	return { success: true as const, data };
}

/** Righe da mostrare, nell'ordine dell'elenco, solo dei campi compilati. */
export function profileRows(profile: unknown): { key: ProfileKey; label: string; value: string }[] {
	const p = (profile && typeof profile === 'object' ? profile : {}) as Record<string, unknown>;
	return PROFILE_FIELDS.flatMap((f) => (typeof p[f.key] === 'string' && p[f.key] ? [{ key: f.key, label: f.label, value: String(p[f.key]) }] : []));
}
