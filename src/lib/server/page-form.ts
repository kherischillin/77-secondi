import { z } from 'zod';
import { isSlug } from '../markup.ts';

export const pageFormSchema = z.object({
	title: z.string().trim().min(2, 'Il titolo deve avere almeno 2 caratteri.').max(80, 'Titolo troppo lungo.'),
	slug: z.string().trim().refine(isSlug, 'Solo lettere minuscole, numeri e trattini (es. regole-delle-quest).'),
	body: z.string().max(100_000, 'Testo troppo lungo.'),
	inFooter: z.boolean(),
	isPublic: z.boolean(),
	sortOrder: z.coerce.number().int().min(-1000).max(1000)
});

export function readPageForm(form: FormData) {
	return pageFormSchema.safeParse({
		title: String(form.get('title') ?? ''),
		slug: String(form.get('slug') ?? ''),
		body: String(form.get('body') ?? '').replace(/\r\n/g, '\n'),
		inFooter: form.get('inFooter') === 'on',
		isPublic: form.get('isPublic') === 'on',
		sortOrder: form.get('sortOrder') || 0
	});
}
