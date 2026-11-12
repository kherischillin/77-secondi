import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser, clientIp } from '#lib/server/guards.ts';
import {
	CharacterError,
	createCharacter,
	getOwnedCharacter,
	listUserCharacters,
	softDeleteCharacter
} from '#lib/server/characters.ts';
import { characterSchema, emailSchema, fieldErrors } from '#lib/validation.ts';
import { changeEmail, isPlaceholderEmail } from '#lib/server/users.ts';
import { verifyPassword } from '#lib/server/auth/password.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { eq } from 'drizzle-orm';
import { getEconomy } from '#lib/server/settings.ts';
import { audit } from '#lib/server/audit.ts';

type FormErrors = Record<string, string>;

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	const characters = await listUserCharacters(user.id);
	return {
		account: { username: user.username, email: isPlaceholderEmail(user.email) ? null : user.email, roles: user.roles, theme: user.theme },
		characters: characters.map((c) => ({
			...c,
			createdAt: c.createdAt.toISOString(),
			lastPlayedAt: c.lastPlayedAt?.toISOString() ?? null
		})),
		activeCharacterId: event.locals.character?.id ?? null,
		maxCharacters: event.locals.settings.maxCharactersPerUser,
		welcome: event.url.searchParams.get('benvenuto'),
		needsCharacter: characters.length === 0 && event.url.searchParams.has('nuovo')
	};
};

function readId(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	email: async (event) => {
		const { user } = requireUser(event);
		const form = await event.request.formData();
		const email = emailSchema.safeParse(form.get('email') ?? '');
		if (!email.success) return fail(400, { action: 'email', error: email.error.issues[0].message });
		const [row] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id));
		if (!row || !(await verifyPassword(row.hash, String(form.get('password') ?? '')))) {
			return fail(400, { action: 'email', error: 'Password non corretta.' });
		}
		if (!(await changeEmail(user.id, email.data))) return fail(400, { action: 'email', error: 'Questa email è già usata da un altro account.' });
		await audit({ actorUserId: user.id, action: 'account.email', ip: clientIp(event) });
		return { action: 'email', success: 'Email aggiornata.' };
	},

	crea: async (event) => {
		const { user } = requireUser(event);
		const form = await event.request.formData();
		const values = {
			name: String(form.get('name') ?? ''),
			surname: String(form.get('surname') ?? ''),
			bio: ''
		};

		const parsed = characterSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { action: 'crea', errors: fieldErrors(parsed.error), values });
		}

		try {
			const character = await createCharacter(
				user.id,
				event.locals.settings.maxCharactersPerUser,
				parsed.data,
				(await getEconomy()).startingMoney
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
		// Senza un personaggio attivo si passa subito alla scelta (con uno solo si entra direttamente).
		if (!event.locals.character) redirect(303, '/scegli-personaggio');
		return { action: 'crea', success: true };
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
