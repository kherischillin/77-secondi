import type { PageServerLoad } from './$types';
import { requireCapability } from '#lib/server/guards.ts';
import { listForMasters, type MasterFilter } from '#lib/server/esiti.ts';

const FILTERS: MasterFilter[] = ['da-assegnare', 'miei', 'aperti', 'chiusi'];

export const load: PageServerLoad = async (event) => {
	const { user } = requireCapability(event, 'esiti.manage');
	const raw = event.url.searchParams.get('filtro') as MasterFilter | null;
	const filter = raw && FILTERS.includes(raw) ? raw : 'da-assegnare';
	return { filter, esiti: await listForMasters(filter, user.id) };
};
