import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { BoardError, createThread, getBoard, listThreads, markBoardRead, viewerFor } from '#lib/server/boards.ts';
import { boardAccess, threadSchema } from '#lib/social.ts';
import { fieldErrors } from '#lib/validation.ts';

async function boardFor(event: Pick<RequestEvent, 'locals' | 'url' | 'params'>) {
	const { user } = requireUser(event);
	const board = await getBoard(Number(event.params.id));
	const viewer = await viewerFor(event.locals);
	// Una bacheca che non si può leggere è, per chi guarda, inesistente.
	if (!board || !boardAccess(board, viewer).canRead) error(404, 'Bacheca non trovata.');
	return { user, board, viewer, access: boardAccess(board, viewer) };
}

export const load: PageServerLoad = async (event) => {
	const { user, board, access } = await boardFor(event);
	const page = Math.max(1, Number(event.url.searchParams.get('pagina')) || 1);
	const { threads, hasNext } = await listThreads(board.id, user.id, page);
	return {
		board: { id: board.id, name: board.name, description: board.description, section: board.section, visibility: board.visibility },
		threads,
		page,
		hasNext,
		access,
		postingAs: access.postsAs === 'character' ? (event.locals.character?.name ?? null) : user.username
	};
};

export const actions: Actions = {
	nuova: async (event) => {
		const { user, board, access } = await boardFor(event);
		if (!access.canStartThread) {
			return fail(403, {
				errors: { form: access.writeBlock ?? 'In questa bacheca le discussioni le apre lo staff.' } as Record<string, string>,
				values: { title: '', body: '' }
			});
		}
		const form = await event.request.formData();
		const values = { title: String(form.get('title') ?? ''), body: String(form.get('body') ?? '') };
		const parsed = threadSchema.safeParse(values);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });

		let thread;
		try {
			thread = await createThread(
				board.id,
				{ userId: user.id, characterId: access.postsAs === 'character' ? event.locals.character!.id : null },
				parsed.data.title,
				parsed.data.body
			);
		} catch (e) {
			if (e instanceof BoardError) return fail(400, { errors: { form: e.message } as Record<string, string>, values });
			throw e;
		}
		redirect(303, `/bacheche/discussione/${thread.id}`);
	},

	letto: async (event) => {
		const { user, board } = await boardFor(event);
		await markBoardRead(user.id, board.id);
		return { read: true };
	}
};
