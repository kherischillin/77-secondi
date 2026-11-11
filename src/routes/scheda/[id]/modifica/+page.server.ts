import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireUser, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { getCharacter } from '#lib/server/sheet.ts';
import { deleteImage, mediaUrl, saveImage, UploadError } from '#lib/server/uploads.ts';
import { getRules } from '#lib/server/settings.ts';
import { audit } from '#lib/server/audit.ts';
import { fieldErrors } from '#lib/validation.ts';

/** Il proprietario, oppure lo staff con il permesso di gestire i personaggi. */
async function editable(event: Pick<RequestEvent, 'locals' | 'url' | 'params'>) {
	const { user } = requireUser(event);
	const character = await getCharacter(Number(event.params.id));
	if (!character || character.deletedAt) error(404, 'Personaggio non trovato.');
	if (character.userId !== user.id && !user.capabilities.has('characters.manage')) {
		error(403, 'Puoi modificare solo i tuoi personaggi.');
	}
	return { user, character };
}

const optionalText = (max: number, label: string) =>
	z
		.string()
		.trim()
		.max(max, `${label}: al massimo ${max} caratteri.`)
		.transform((s) => (s === '' ? null : s));

const sheetSchema = z.object({
	bio: optionalText(2000, 'Presentazione'),
	appearance: optionalText(5000, 'Aspetto'),
	personality: optionalText(5000, 'Carattere'),
	background: optionalText(20000, 'Background'),
	portraitCredit: optionalText(100, 'Presta-volto')
});

export const load: PageServerLoad = async (event) => {
	const { character } = await editable(event);
	const rules = await getRules();
	return {
		character: {
			id: character.id,
			name: character.name,
			surname: character.surname,
			bio: character.bio,
			appearance: character.appearance,
			personality: character.personality,
			background: character.background,
			portraitUrl: mediaUrl(character.portrait),
			portraitCredit: character.portraitCredit
		},
		backgroundPublic: rules.backgroundPublic
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { user, character } = await editable(event);
		const form = await event.request.formData();
		const parsed = sheetSchema.safeParse({
			bio: String(form.get('bio') ?? ''),
			appearance: String(form.get('appearance') ?? ''),
			personality: String(form.get('personality') ?? ''),
			background: String(form.get('background') ?? ''),
			portraitCredit: String(form.get('portraitCredit') ?? '')
		});
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });

		let portrait = character.portrait;
		try {
			const uploaded = await saveImage(form.get('portrait'));
			if (uploaded) portrait = uploaded;
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { errors: { portrait: e.message } as Record<string, string> });
			throw e;
		}
		if (form.get('removePortrait') === 'on') portrait = null;

		await db.update(schema.characters).set({ ...parsed.data, portrait }).where(eq(schema.characters.id, character.id));
		if (portrait !== character.portrait) await deleteImage(character.portrait);
		await audit({
			actorUserId: user.id,
			action: 'sheet.update',
			targetType: 'character',
			targetId: character.id,
			details: { personaggio: character.name, daStaff: character.userId !== user.id },
			ip: clientIp(event)
		});
		redirect(303, `/scheda/${character.id}`);
	}
};
