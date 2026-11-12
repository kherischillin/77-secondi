import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { archivedCount, deleteForMe, listThreads, MessageError, setArchived } from '#lib/server/messages.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const archived = event.url.searchParams.has('archivio');
	const [threads, inArchive] = await Promise.all([listThreads(character.id, archived), archivedCount(character.id)]);
	return {
		archived,
		threads,
		me: character,
		archive: { count: inArchive, limit: event.locals.settings.missiveArchiveLimit },
		autoDeleteDays: event.locals.settings.missiveAutoDeleteDays
	};
};

const ids = (form: FormData) => form.getAll('id').map((v) => Number(v));

export const actions: Actions = {
	/** Elimina le missive selezionate (solo per sé: l'altro personaggio le conserva). */
	elimina: async (event) => {
		const { character } = requireCharacter(event);
		const selected = ids(await event.request.formData());
		if (!selected.length) return fail(400, { error: 'Seleziona almeno una missiva.' });
		const n = await deleteForMe(selected, character.id);
		return { success: n === 1 ? 'Missiva eliminata.' : `${n} missive eliminate.` };
	},
	archivia: async (event) => {
		const { character } = requireCharacter(event);
		const [id] = ids(await event.request.formData());
		try {
			await setArchived(id, character.id, true, event.locals.settings.missiveArchiveLimit);
		} catch (e) {
			if (e instanceof MessageError) return fail(400, { error: e.message });
			throw e;
		}
		return { success: 'Missiva archiviata.' };
	},
	ripristina: async (event) => {
		const { character } = requireCharacter(event);
		const [id] = ids(await event.request.formData());
		await setArchived(id, character.id, false);
		return { success: 'Missiva riportata tra quelle in arrivo.' };
	}
};
