import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { getPageBySlug, listPages } from '#lib/server/pages.ts';
import { slugify, isSlug } from '#lib/markup.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'pages.manage');
	const pages = await listPages();
	return { pages: pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, inFooter: p.inFooter, isPublic: p.isPublic, updatedAt: p.updatedAt.toISOString() })) };
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireCapability(event, 'pages.manage');
		const title = String((await event.request.formData()).get('title') ?? '').trim();
		if (title.length < 2 || title.length > 80) return fail(400, { error: 'Il titolo deve avere tra 2 e 80 caratteri.', title });
		const slug = slugify(title);
		if (!isSlug(slug)) return fail(400, { error: 'Usa un titolo con almeno una lettera o un numero.', title });
		if (await getPageBySlug(slug)) return fail(400, { error: `Esiste già una pagina con indirizzo /pagine/${slug}.`, title });
		const [page] = await db.insert(schema.pages).values({ title, slug, body: '', updatedByUserId: user.id, sortOrder: 10 }).returning();
		await audit({ actorUserId: user.id, action: 'page.create', targetType: 'page', targetId: page.id, details: { titolo: title }, ip: clientIp(event) });
		redirect(303, `/gestione/pagine/${page.id}`);
	}
};
