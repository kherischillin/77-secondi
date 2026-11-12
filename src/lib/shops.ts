/** Negozi del mercato: validazione del modulo dello staff (pura, usata dal server). */
import { z } from 'zod';
import { isJobIcon } from './job-icons.ts';

export const shopFormSchema = z.object({
	name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(60, 'Al massimo 60 caratteri.'),
	tagline: z.string().trim().max(60, 'Al massimo 60 caratteri.'),
	description: z.string().trim().max(1000, 'Al massimo 1000 caratteri.'),
	icon: z.string().refine(isJobIcon, 'Scegli un’icona dall’elenco.'),
	sortOrder: z.coerce.number().int().min(-1000).max(1000).catch(0),
	isOpen: z.boolean()
});

export type ShopForm = z.infer<typeof shopFormSchema>;

export function readShopForm(form: FormData) {
	return shopFormSchema.safeParse({
		name: String(form.get('name') ?? ''),
		tagline: String(form.get('tagline') ?? ''),
		description: String(form.get('description') ?? ''),
		icon: String(form.get('icon') || 'stall'),
		sortOrder: form.get('sortOrder') ?? 0,
		isOpen: form.get('isOpen') === 'on'
	});
}
