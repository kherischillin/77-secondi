import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { getOwnedCharacter, listUserCharacters, touchCharacter } from '#lib/server/characters.ts';
import { setActiveCharacter } from '#lib/server/auth/session.ts';
import { portraitSrc } from '#lib/server/sheet.ts';

/**
 * Scelta del personaggio dopo l'accesso, e "Esci → Cambia personaggio".
 * Senza personaggi si va a crearne uno; con un solo personaggio si entra subito.
 */
export const load: PageServerLoad = async (event) => {
	const { user, session } = requireUser(event);
	const characters = await listUserCharacters(user.id);
	if (characters.length === 0) redirect(303, '/account?nuovo=1');
	if (characters.length === 1 && !event.locals.character) {
		await setActiveCharacter(session.id, characters[0].id);
		await touchCharacter(characters[0].id);
		redirect(303, '/gioco');
	}
	const hosts = event.locals.settings.portraitHosts;
	return {
		activeId: event.locals.character?.id ?? null,
		characters: characters.map((c) => ({
			id: c.id,
			name: c.name,
			surname: c.surname,
			portraitUrl: portraitSrc(c.portrait, hosts),
			lastPlayedAt: c.lastPlayedAt?.toISOString() ?? null
		}))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { user, session } = requireUser(event);
		const id = Number((await event.request.formData()).get('id'));
		const character = Number.isInteger(id) ? await getOwnedCharacter(user.id, id) : null;
		if (!character) return fail(404, { error: 'Personaggio non trovato.' });
		await setActiveCharacter(session.id, character.id);
		await touchCharacter(character.id);
		redirect(303, '/gioco');
	}
};
