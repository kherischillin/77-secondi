import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { getPage } from '#lib/server/pages.ts';
import { readPageForm } from '#lib/server/page-form.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

async function pageOr404(event: RequestEvent) {
	const page = await getPage(Number(event.params.id));
	if (!page) error(404, 'Pagina non trovata.');
	return page;
}

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'pages.manage');
	const p = await pageOr404(event);
	return { page: { id: p.id, slug: p.slug, title: p.title, body: p.body, inFooter: p.inFooter, isPublic: p.isPublic, sortOrder: p.sortOrder } };
};

export const actions: Actions = {
	salva: async (event) => {
		const { user } = requireCapability(event, 'pages.manage');
		const page = await pageOr404(event);
		const parsed = readPageForm(await event.request.formData());
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		const [clash] = await db
			.select({ id: schema.pages.id })
			.from(schema.pages)
			.where(and(eq(schema.pages.slug, parsed.data.slug), ne(schema.pages.id, page.id)));
		if (clash) return fail(400, { errors: { slug: 'Questo indirizzo è già usato da un’altra pagina.' } as Record<string, string> });
		await db
			.update(schema.pages)
			.set({ ...parsed.data, updatedAt: new Date(), updatedByUserId: user.id })
			.where(eq(schema.pages.id, page.id));
		await audit({ actorUserId: user.id, action: 'page.update', targetType: 'page', targetId: page.id, details: { titolo: parsed.data.title }, ip: clientIp(event) });
		return { success: 'Pagina salvata.' };
	},
	elimina: async (event) => {
		const { user } = requireCapability(event, 'pages.manage');
		const page = await pageOr404(event);
		await db.delete(schema.pages).where(eq(schema.pages.id, page.id));
		await audit({ actorUserId: user.id, action: 'page.delete', targetType: 'page', targetId: page.id, details: { titolo: page.title }, ip: clientIp(event) });
		redirect(303, '/gestione/pagine');
	}
};
