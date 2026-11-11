import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { masterCan } = await parent();
	redirect(303, masterCan.esiti ? '/master/esiti' : '/master/giocate');
};
