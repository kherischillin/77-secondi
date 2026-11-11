import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { createEsito, listForCharacter } from '#lib/server/esiti.ts';
import { newEsitoSchema } from '#lib/master.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	return { esiti: await listForCharacter(character.id), me: character };
};

export const actions: Actions = {
	default: async (event) => {
		const { user, character } = requireCharacter(event);
		const form = await event.request.formData();
		const values = {
			title: String(form.get('title') ?? ''),
			body: String(form.get('body') ?? ''),
			offNote: String(form.get('offNote') ?? '')
		};
		const parsed = newEsitoSchema.safeParse(values);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });
		const esito = await createEsito(character.id, user.id, parsed.data);
		await audit({ actorUserId: user.id, action: 'esito.create', targetType: 'esito', targetId: esito.id, details: { titolo: esito.title, personaggio: character.name }, ip: clientIp(event) });
		redirect(303, `/esiti/${esito.id}`);
	}
};
