import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { requireUser } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { NOTIFY_OPTIONS, readNotify, type NotifyPrefs } from '#lib/notify.ts';

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	return { prefs: readNotify(user.notify) };
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireUser(event);
		const form = await event.request.formData();
		const prefs = Object.fromEntries(NOTIFY_OPTIONS.map((o) => [o.key, form.get(o.key) === 'on'])) as NotifyPrefs;
		await db.update(schema.users).set({ notify: prefs }).where(eq(schema.users.id, user.id));
		return { success: 'Preferenze salvate.' };
	}
};
