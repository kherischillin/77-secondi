import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { searchCharacters } from '#lib/server/messages.ts';

/** Suggerimenti per i campi "nome del personaggio" (missive, inviti nelle stanze private). */
export const GET: RequestHandler = async (event) => {
	const { user } = requireCharacter(event);
	const q = (event.url.searchParams.get('q') ?? '').trim().slice(0, 60);
	if (!q) return json([]);
	return json(await searchCharacters(q, user.id));
};
