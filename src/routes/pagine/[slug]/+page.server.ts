import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPageBySlug } from '#lib/server/pages.ts';
import { renderMarkup } from '#lib/markup.ts';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const page = await getPageBySlug(params.slug);
	if (!page) error(404, 'Pagina non trovata.');
	if (!page.isPublic && !locals.user) redirect(303, `/accesso?dopo=${encodeURIComponent(url.pathname)}`);
	return {
		page: { id: page.id, title: page.title, html: renderMarkup(page.body), updatedAt: page.updatedAt.toISOString() },
		canEdit: locals.user?.capabilities.has('pages.manage') ?? false
	};
};
