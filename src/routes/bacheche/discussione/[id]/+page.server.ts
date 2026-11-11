import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireUser, clientIp } from '#lib/server/guards.ts';
import {
	BoardError,
	addPost,
	deleteThread,
	editPost,
	getBoard,
	getThread,
	listPosts,
	markRead,
	setPostHidden,
	setThreadFlags,
	viewerFor
} from '#lib/server/boards.ts';
import { boardAccess, postSchema } from '#lib/social.ts';
import { audit } from '#lib/server/audit.ts';

async function threadFor(event: Pick<RequestEvent, 'locals' | 'url' | 'params'>) {
	const { user } = requireUser(event);
	const thread = await getThread(Number(event.params.id));
	const board = thread ? await getBoard(thread.boardId) : null;
	const viewer = await viewerFor(event.locals);
	if (!thread || !board || !boardAccess(board, viewer).canRead) error(404, 'Discussione non trovata.');
	return { user, thread, board, viewer, access: boardAccess(board, viewer, thread.isLocked) };
}

export const load: PageServerLoad = async (event) => {
	const { user, thread, board, viewer, access } = await threadFor(event);
	const page = Math.max(1, Number(event.url.searchParams.get('pagina')) || 1);
	const { posts, pages } = await listPosts(thread.id, page, viewer.canModerate);
	await markRead(user.id, thread.id);
	return {
		thread: { id: thread.id, title: thread.title, isPinned: thread.isPinned, isLocked: thread.isLocked },
		board: { id: board.id, name: board.name, section: board.section },
		posts: posts.map((p) => ({ ...p, mine: p.authorUserId === user.id, authorUserId: undefined })),
		page,
		pages,
		access,
		canModerate: viewer.canModerate,
		postingAs: access.postsAs === 'character' ? (event.locals.character?.name ?? null) : user.username
	};
};

async function moderatorOnly(event: RequestEvent) {
	const ctx = await threadFor(event);
	if (!ctx.viewer.canModerate) error(403, 'Solo i moderatori possono farlo.');
	return ctx;
}

export const actions: Actions = {
	rispondi: async (event) => {
		const { user, thread, access } = await threadFor(event);
		if (!access.canReply) return fail(403, { error: access.writeBlock ?? 'Non puoi rispondere qui.' });
		const parsed = postSchema.safeParse({ body: String((await event.request.formData()).get('body') ?? '') });
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		try {
			await addPost(thread.id, { userId: user.id, characterId: access.postsAs === 'character' ? event.locals.character!.id : null }, parsed.data.body);
		} catch (e) {
			if (e instanceof BoardError) return fail(400, { error: e.message });
			throw e;
		}
		await markRead(user.id, thread.id);
		// Si torna all'ultima pagina, dove c'è il nuovo messaggio.
		const { pages } = await listPosts(thread.id, 1, false);
		redirect(303, `/bacheche/discussione/${thread.id}?pagina=${pages}#fondo`);
	},

	modifica: async (event) => {
		const { user } = await threadFor(event);
		const form = await event.request.formData();
		const parsed = postSchema.safeParse({ body: String(form.get('body') ?? '') });
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		try {
			await editPost(Number(form.get('id')), user.id, parsed.data.body);
		} catch (e) {
			if (e instanceof BoardError) return fail(400, { error: e.message });
			throw e;
		}
		return { edited: true };
	},

	nascondi: async (event) => moderatePost(event, true),
	ripristina: async (event) => moderatePost(event, false),

	fissa: async (event) => {
		const { user, thread } = await moderatorOnly(event);
		await setThreadFlags(thread.id, { isPinned: !thread.isPinned });
		await audit({ actorUserId: user.id, action: 'board.moderate', targetType: 'board_thread', targetId: thread.id, details: { azione: thread.isPinned ? 'tolta evidenza' : 'messa in evidenza', titolo: thread.title }, ip: clientIp(event) });
		return { moderated: true };
	},

	blocca: async (event) => {
		const { user, thread } = await moderatorOnly(event);
		await setThreadFlags(thread.id, { isLocked: !thread.isLocked });
		await audit({ actorUserId: user.id, action: 'board.moderate', targetType: 'board_thread', targetId: thread.id, details: { azione: thread.isLocked ? 'riaperta' : 'chiusa', titolo: thread.title }, ip: clientIp(event) });
		return { moderated: true };
	},

	elimina: async (event) => {
		const { user, thread, board } = await moderatorOnly(event);
		await deleteThread(thread.id);
		await audit({ actorUserId: user.id, action: 'board.moderate', targetType: 'board_thread', targetId: thread.id, details: { azione: 'discussione eliminata', titolo: thread.title }, ip: clientIp(event) });
		redirect(303, `/bacheche/${board.id}`);
	}
};

async function moderatePost(event: RequestEvent, hidden: boolean) {
	const { user } = await moderatorOnly(event);
	const id = Number((await event.request.formData()).get('id'));
	const post = await setPostHidden(id, user.id, hidden);
	if (!post) return fail(404, { error: 'Messaggio non trovato.' });
	await audit({ actorUserId: user.id, action: 'board.moderate', targetType: 'board_post', targetId: id, details: { azione: hidden ? 'messaggio nascosto' : 'messaggio ripristinato', testo: post.body.slice(0, 200) }, ip: clientIp(event) });
	return { moderated: true };
}
