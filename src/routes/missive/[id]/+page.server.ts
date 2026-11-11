import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { MessageError, openThread, reply, setArchived } from '#lib/server/messages.ts';
import { replySchema } from '#lib/social.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const thread = await openThread(Number(event.params.id), character.id);
	// Chi non partecipa riceve "non trovata": non si rivela nemmeno che esiste.
	if (!thread) error(404, 'Missiva non trovata.');
	return { ...thread, me: character.id };
};

export const actions: Actions = {
	rispondi: async (event) => {
		const { character } = requireCharacter(event);
		const form = await event.request.formData();
		const parsed = replySchema.safeParse({ body: String(form.get('body') ?? '') });
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		try {
			await reply(Number(event.params.id), character.id, parsed.data.body);
		} catch (e) {
			if (e instanceof MessageError) return fail(400, { error: e.message });
			throw e;
		}
		return { sent: true };
	},
	archivia: async (event) => {
		const { character } = requireCharacter(event);
		await setArchived(Number(event.params.id), character.id, true);
		return { archived: true };
	},
	ripristina: async (event) => {
		const { character } = requireCharacter(event);
		await setArchived(Number(event.params.id), character.id, false);
		return { archived: false };
	}
};
