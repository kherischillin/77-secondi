import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isBanned } from '#lib/server/users.ts';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user || !isBanned(locals.user)) redirect(303, '/');
	return {
		until: locals.user.bannedUntil!.toISOString(),
		reason: locals.user.banReason
	};
};
