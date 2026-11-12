import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { MessageError, startThread } from '#lib/server/messages.ts';
import { newMessageSchema } from '#lib/social.ts';
import { fieldErrors } from '#lib/validation.ts';

export const load: PageServerLoad = async (event) => {
	requireCharacter(event);
	return { to: (event.url.searchParams.get('a') ?? '').slice(0, 80) };
};

export const actions: Actions = {
	default: async (event) => {
		const { user, character } = requireCharacter(event);
		const form = await event.request.formData();
		const values = {
			to: String(form.get('to') ?? ''),
			subject: String(form.get('subject') ?? ''),
			body: String(form.get('body') ?? ''),
			onGame: form.get('onGame') !== 'off'
		};
		const parsed = newMessageSchema.safeParse(values);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });

		let thread;
		try {
			thread = await startThread({ id: character.id, userId: user.id }, parsed.data.to, parsed.data);
		} catch (e) {
			if (e instanceof MessageError) return fail(400, { errors: { to: e.message } as Record<string, string>, values });
			throw e;
		}
		redirect(303, `/missive/${thread.id}`);
	}
};
