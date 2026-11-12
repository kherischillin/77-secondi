/** Lavori liberi: validazione del modulo dello staff (pura, usata dal server). */
import { z } from 'zod';
import { MAX_AMOUNT } from './economy.ts';

export const jobFormSchema = z.object({
	name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(60, 'Al massimo 60 caratteri.'),
	description: z.string().trim().max(1000, 'Al massimo 1000 caratteri.'),
	pay: z.coerce.number({ error: 'Scrivi la paga.' }).int('Solo numeri interi.').min(0, 'La paga non può essere negativa.').max(MAX_AMOUNT),
	sortOrder: z.coerce.number().int().min(-1000).max(1000).catch(0),
	isOpen: z.boolean()
});

export type JobForm = z.infer<typeof jobFormSchema>;

export function readJobForm(form: FormData) {
	return jobFormSchema.safeParse({
		name: String(form.get('name') ?? ''),
		description: String(form.get('description') ?? ''),
		pay: form.get('pay'),
		sortOrder: form.get('sortOrder') ?? 0,
		isOpen: form.get('isOpen') === 'on'
	});
}
