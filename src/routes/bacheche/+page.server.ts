import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { listBoards, viewerFor } from '#lib/server/boards.ts';

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	const boards = await listBoards(await viewerFor(event.locals), user.id);
	return {
		on: boards.filter((b) => b.section === 'on' && b.visibility !== 'guild'),
		off: boards.filter((b) => b.section === 'off' && b.visibility !== 'guild'),
		guild: boards.filter((b) => b.visibility === 'guild'),
		canManage: user.capabilities.has('boards.manage')
	};
};
