import { z } from 'zod';

/**
 * Regole di validazione dei dati inseriti dagli utenti.
 * Messaggi in italiano, pensati per essere mostrati direttamente nei form.
 */

export const usernameSchema = z
	.string()
	.trim()
	.min(3, 'Il nome utente deve avere almeno 3 caratteri.')
	.max(24, 'Il nome utente può avere al massimo 24 caratteri.')
	.regex(/^[a-zA-Z0-9_.-]+$/, 'Usa solo lettere, numeri, punto, trattino e trattino basso.');

export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.max(254, 'Indirizzo email troppo lungo.')
	.pipe(z.email('Indirizzo email non valido.'));

export const passwordSchema = z
	.string()
	.min(10, 'La password deve avere almeno 10 caratteri.')
	.max(200, 'La password è troppo lunga.');

export const registerSchema = z
	.object({
		username: usernameSchema,
		email: emailSchema,
		password: passwordSchema,
		passwordConfirm: z.string()
	})
	.refine((d) => d.password === d.passwordConfirm, {
		message: 'Le due password non coincidono.',
		path: ['passwordConfirm']
	});

export const loginSchema = z.object({
	username: z.string().trim().min(1, 'Inserisci il nome utente.').max(254),
	password: z.string().min(1, 'Inserisci la password.').max(200)
});

/** Nomi dei personaggi: lettere (anche accentate), spazi, apostrofi e trattini. */
const characterNamePart = (label: string, min: number) =>
	z
		.string()
		.trim()
		.min(min, `${label}: almeno ${min} caratteri.`)
		.max(30, `${label}: al massimo 30 caratteri.`)
		.regex(
			/^[\p{L}][\p{L}' -]*$/u,
			`${label}: usa solo lettere, spazi, apostrofi e trattini, iniziando con una lettera.`
		)
		.transform((s) => s.replace(/\s+/g, ' '));

export const characterSchema = z.object({
	name: characterNamePart('Nome', 2),
	surname: z
		.string()
		.trim()
		.max(30)
		.transform((s) => (s === '' ? null : s))
		.pipe(characterNamePart('Cognome', 2).nullable()),
	bio: z
		.string()
		.trim()
		.max(2000, 'La presentazione può avere al massimo 2000 caratteri.')
		.transform((s) => (s === '' ? null : s))
});

/** Trasforma gli errori di zod in { campo: messaggio } per i form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? 'form');
		out[key] ??= issue.message;
	}
	return out;
}
