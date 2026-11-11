import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { getLocation, getMap, toLocationView } from '#lib/server/world.ts';
import { enterLocation, listPresentAt } from '#lib/server/presence.ts';
import { ChatError, loadHistory, postMessage, setHidden } from '#lib/server/chat-service.ts';
import { parseChatInput, type ChosenKind } from '#lib/chat.ts';
import { audit } from '#lib/server/audit.ts';

async function loadPlayable(idParam: string) {
	const location = await getLocation(Number(idParam));
	if (!location || !location.isActive) error(404, 'Luogo non trovato.');
	if (location.kind === 'map_link') {
		redirect(303, location.linkedMapId ? `/gioco/mappa/${location.linkedMapId}` : '/gioco');
	}
	return location;
}

export const load: PageServerLoad = async (event) => {
	const { user, character } = requireCharacter(event);
	const location = await loadPlayable(event.params.id);
	const map = await getMap(location.mapId);

	await enterLocation(character.id, location.mapId, location.id);

	const canModerate = user.capabilities.has('chat.moderate');
	const [history, present] = await Promise.all([
		loadHistory(location.id, { characterId: character.id, canModerate }),
		listPresentAt(location.id)
	]);

	return {
		location: toLocationView(location),
		map: map ? { id: map.id, name: map.name } : null,
		history,
		present,
		me: character.id,
		can: {
			master: user.capabilities.has('chat.master'),
			npc: user.capabilities.has('chat.npc'),
			moderate: canModerate
		}
	};
};

const CHOSEN: ChosenKind[] = ['action', 'whisper', 'master', 'npc'];

export const actions: Actions = {
	invia: async (event) => {
		const { user, character } = requireCharacter(event);
		const location = await loadPlayable(event.params.id);
		const form = await event.request.formData();
		const kindRaw = String(form.get('kind') ?? 'action');
		const kind = (CHOSEN.includes(kindRaw as ChosenKind) ? kindRaw : 'action') as ChosenKind;

		const parsed = parseChatInput({
			text: String(form.get('text') ?? ''),
			kind,
			tag: String(form.get('tag') ?? ''),
			npcName: String(form.get('npcName') ?? ''),
			recipient: String(form.get('recipient') ?? '')
		});
		if ('error' in parsed) return fail(400, { error: parsed.error });

		try {
			await postMessage(location.id, { userId: user.id, characterId: character.id, capabilities: user.capabilities }, parsed);
		} catch (e) {
			if (e instanceof ChatError) return fail(400, { error: e.message });
			throw e;
		}
		return { sent: true };
	},

	nascondi: async (event) => moderate(event, true),
	ripristina: async (event) => moderate(event, false)
};

async function moderate(event: Parameters<Actions[string]>[0], hidden: boolean) {
	const { user } = requireCharacter(event);
	if (!user.capabilities.has('chat.moderate')) error(403, 'Non hai i permessi per moderare la chat.');
	const form = await event.request.formData();
	const id = Number(form.get('id'));
	if (!Number.isInteger(id) || id <= 0) return fail(400, { error: 'Messaggio non valido.' });

	const view = await setHidden(id, user.id, hidden);
	if (!view) return fail(404, { error: 'Messaggio non trovato.' });
	await audit({
		actorUserId: user.id,
		action: hidden ? 'chat.hide' : 'chat.unhide',
		targetType: 'chat_message',
		targetId: id,
		details: { autore: view.characterName, testo: view.body.slice(0, 200) },
		ip: clientIp(event)
	});
	return { moderated: true };
}
