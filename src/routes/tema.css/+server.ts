import type { RequestHandler } from './$types';

/** CSS personalizzato dello staff (Gestione → Impostazioni), aggiunto a tutti i temi. */
export const GET: RequestHandler = async ({ locals }) => {
	return new Response(locals.settings.customCss, {
		headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' }
	});
};
