import type { PageServerLoad } from './$types';
import { requireCapability } from '#lib/server/guards.ts';
import { listForReview } from '#lib/server/giocate.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'giocate.review');
	const filter = event.url.searchParams.get('filtro') === 'riviste' ? 'riviste' : 'da-rivedere';
	return { filter, giocate: await listForReview(filter) };
};
