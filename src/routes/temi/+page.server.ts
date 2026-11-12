import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { isTheme } from '#lib/themes.ts';

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	return { theme: user.theme, siteTheme: event.locals.settings.theme };
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireUser(event);
		const raw = String((await event.request.formData()).get('theme') ?? '');
		const theme = raw === '' ? null : isTheme(raw) ? raw : undefined;
		if (theme === undefined) return fail(400, { error: 'Tema non valido.' });
		await db.update(schema.users).set({ theme }).where(eq(schema.users.id, user.id));
		return { success: 'Tema aggiornato.' };
	}
};
