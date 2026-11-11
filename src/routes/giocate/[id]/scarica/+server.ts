import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canReadGiocata, getGiocata, giocataView } from '#lib/server/giocate.ts';
import { isBanned } from '#lib/server/users.ts';
import { renderGiocataHtml } from '#lib/master.ts';

/** Scarica la giocata come pagina HTML autonoma (si apre con qualsiasi browser, anche offline). */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	if (!user || isBanned(user)) error(401, 'Accedi per scaricare la giocata.');
	const g = await getGiocata(Number(params.id));
	if (!g || !(await canReadGiocata(g, user))) error(404, 'Giocata non trovata.');
	const view = giocataView(g);
	const html = renderGiocataHtml({ ...view, siteName: locals.settings.siteName });
	const filename = `giocata-${g.id}-${g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'senza-titolo'}.html`;
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
		}
	});
};
