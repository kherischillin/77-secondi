import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireUser, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { getCharacter } from '#lib/server/sheet.ts';
import { deleteImage, mediaUrl } from '#lib/server/uploads.ts';
import { checkPortraitUrl, isPortraitLink } from '#lib/portrait.ts';
import { readProfile } from '#lib/profile.ts';
import { occupationOf } from '#lib/server/jobs.ts';
import { getRules } from '#lib/server/settings.ts';
import { audit } from '#lib/server/audit.ts';
import { fieldErrors } from '#lib/validation.ts';
import { SHEET_LIMITS } from '#lib/sheet-html.ts';

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
	appearance: optionalText(SHEET_LIMITS.appearance, 'Aspetto'),
	personality: optionalText(SHEET_LIMITS.personality, 'Carattere'),
	background: optionalText(SHEET_LIMITS.background, 'Background'),
	offGame: optionalText(SHEET_LIMITS.offGame, 'OFF Game'),
	portraitCredit: optionalText(100, 'Presta-volto')
});

export const load: PageServerLoad = async (event) => {
	const { character } = await editable(event);
	const rules = await getRules();
	return {
		occupation: await occupationOf(character.id),
		character: {
			id: character.id,
			name: character.name,
			surname: character.surname,
			profile: character.profile ?? {},
			appearance: character.appearance,
			personality: character.personality,
			background: character.background,
			offGame: character.offGame,
			// Un link resta modificabile; un vecchio file caricato sul sito si vede solo in anteprima.
			portraitLink: isPortraitLink(character.portrait) ? character.portrait : '',
			legacyPortraitUrl: isPortraitLink(character.portrait) ? null : mediaUrl(character.portrait),
			portraitCredit: character.portraitCredit,
			avatarLink: character.avatar ?? ''
		},
		backgroundPublic: rules.backgroundPublic,
		portrait: {
			hosts: event.locals.settings.portraitHosts,
			maxWidth: event.locals.settings.portraitMaxWidth,
			maxHeight: event.locals.settings.portraitMaxHeight
		}
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { user, character } = await editable(event);
		const form = await event.request.formData();
		const parsed = sheetSchema.safeParse({
			appearance: String(form.get('appearance') ?? ''),
			personality: String(form.get('personality') ?? ''),
			background: String(form.get('background') ?? ''),
			offGame: String(form.get('offGame') ?? ''),
			portraitCredit: String(form.get('portraitCredit') ?? '')
		});
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		const profile = readProfile(form);
		if (!profile.success) {
			const issue = profile.error.issues[0];
			return fail(400, { errors: { [`profile_${String(issue.path[0])}`]: issue.message } as Record<string, string> });
		}

		// Presta-volto: link HTTPS da un sito ammesso. Campo vuoto = nessuna immagine
		// (un vecchio file caricato sul sito resta finché non lo si sostituisce o rimuove).
		const link = String(form.get('portraitUrl') ?? '').trim();
		let portrait: string | null;
		if (link) {
			const check = checkPortraitUrl(link, event.locals.settings.portraitHosts);
			if (!check.ok) return fail(400, { errors: { portraitUrl: check.error } as Record<string, string> });
			portrait = check.url;
		} else if (character.portrait && !isPortraitLink(character.portrait) && form.get('removePortrait') !== 'on') {
			portrait = character.portrait;
		} else {
			portrait = null;
		}

		// Avatar quadrato: stesse regole del presta-volto (HTTPS, siti ammessi). Vuoto = iniziale del nome.
		const avatarLink = String(form.get('avatarUrl') ?? '').trim();
		let avatar: string | null = null;
		if (avatarLink) {
			const check = checkPortraitUrl(avatarLink, event.locals.settings.portraitHosts);
			if (!check.ok) return fail(400, { errors: { avatarUrl: check.error } as Record<string, string> });
			avatar = check.url;
		}

		await db
			.update(schema.characters)
			.set({ ...parsed.data, profile: profile.data, portrait, avatar })
			.where(eq(schema.characters.id, character.id));
		// Il vecchio file caricato sul sito non serve più.
		if (portrait !== character.portrait && character.portrait && !isPortraitLink(character.portrait)) await deleteImage(character.portrait);
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
