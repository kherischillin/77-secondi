import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser, clientIp } from '#lib/server/guards.ts';
import {
	CharacterError,
	createCharacter,
	getOwnedCharacter,
	listUserCharacters,
	softDeleteCharacter,
	touchCharacter
} from '#lib/server/characters.ts';
import { setActiveCharacter } from '#lib/server/auth/session.ts';
import { characterSchema, fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

type FormErrors = Record<string, string>;

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	const characters = await listUserCharacters(user.id);
	return {
		account: { username: user.username, email: user.email, roles: user.roles },
		characters: characters.map((c) => ({
			...c,
			createdAt: c.createdAt.toISOString(),
			lastPlayedAt: c.lastPlayedAt?.toISOString() ?? null
		})),
		activeCharacterId: event.locals.character?.id ?? null,
		maxCharacters: event.locals.settings.maxCharactersPerUser,
		welcome: event.url.searchParams.get('benvenuto')
	};
};

function readId(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	crea: async (event) => {
		const { user } = requireUser(event);
		const form = await event.request.formData();
		const values = {
			name: String(form.get('name') ?? ''),
			surname: String(form.get('surname') ?? ''),
			bio: String(form.get('bio') ?? '')
		};

		const parsed = characterSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { action: 'crea', errors: fieldErrors(parsed.error), values });
		}

		try {
			const character = await createCharacter(
				user.id,
				event.locals.settings.maxCharactersPerUser,
				parsed.data
			);
			await audit({
				actorUserId: user.id,
				action: 'character.create',
				targetType: 'character',
				targetId: character.id,
				details: { nome: character.name },
				ip: clientIp(event)
			});
		} catch (e) {
			if (e instanceof CharacterError) {
				return fail(400, { action: 'crea', errors: { [e.field]: e.message } as FormErrors, values });
			}
			throw e;
		}
		return { action: 'crea', success: true };
	},

	gioca: async (event) => {
		const { user, session } = requireUser(event);
		const id = readId(await event.request.formData());
		const character = id ? await getOwnedCharacter(user.id, id) : null;
		if (!character) return fail(404, { action: 'gioca', errors: { form: 'Personaggio non trovato.' } as FormErrors });

		await setActiveCharacter(session.id, character.id);
		await touchCharacter(character.id);
		redirect(303, '/gioco');
	},

	elimina: async (event) => {
		const { user } = requireUser(event);
		const form = await event.request.formData();
		const id = readId(form);
		const character = id ? await getOwnedCharacter(user.id, id) : null;
		if (!character) return fail(404, { action: 'elimina', errors: { form: 'Personaggio non trovato.' } as FormErrors });

		// Conferma esplicita: bisogna riscrivere il nome del personaggio.
		const confirmName = String(form.get('confirm') ?? '').trim();
		if (confirmName.toLowerCase() !== character.name.toLowerCase()) {
			return fail(400, {
				action: 'elimina',
				deleteId: character.id,
				errors: { confirm: 'Per confermare scrivi esattamente il nome del personaggio.' } as FormErrors
			});
		}

		await softDeleteCharacter(character.id);
		await audit({
			actorUserId: user.id,
			action: 'character.delete',
			targetType: 'character',
			targetId: character.id,
			details: { nome: character.name },
			ip: clientIp(event)
		});
		return { action: 'elimina', success: true };
	}
};
