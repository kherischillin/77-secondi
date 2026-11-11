import { error, fail, redirect } from '@sveltejs/kit';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { getLocation, getMap, toLocationView } from '#lib/server/world.ts';
import { enterLocation, listPresentAt } from '#lib/server/presence.ts';
import { ChatError, loadHistory, postCheck, postMessage, postSystem, setHidden } from '#lib/server/chat-service.ts';
import { parseChatInput, type ChosenKind } from '#lib/chat.ts';
import { audit } from '#lib/server/audit.ts';
import { getRules } from '#lib/server/settings.ts';
import { endQuest, getActiveQuest, QuestError, startQuest } from '#lib/server/quests.ts';
import { broadcastQuestChanged } from '#lib/server/realtime.ts';
import { checkValues, getCharacter, listSkills, listStats } from '#lib/server/sheet.ts';
import { computeCheck } from '#lib/rules.ts';
import { fullName } from '#lib/format.ts';

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
	const [history, present, quest, rules, stats, skills, me] = await Promise.all([
		loadHistory(location.id, { characterId: character.id, canModerate }),
		listPresentAt(location.id),
		getActiveQuest(location.id),
		getRules(),
		listStats(),
		listSkills(),
		getCharacter(character.id)
	]);

	return {
		location: toLocationView(location),
		map: map ? { id: map.id, name: map.name } : null,
		history,
		present,
		me: character.id,
		quest,
		questDie: rules.questDie,
		diceAllowed: !!quest || rules.diceOutsideQuest,
		statsAllocated: me?.statsAllocated ?? false,
		checkOptions: {
			stats: stats.map((s) => ({ id: s.id, name: s.name })),
			skills: skills.map((s) => ({ id: s.id, name: s.name }))
		},
		can: {
			master: user.capabilities.has('chat.master'),
			npc: user.capabilities.has('chat.npc'),
			moderate: canModerate,
			awardXp: user.capabilities.has('xp.award')
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

		const [quest, rules] = await Promise.all([getActiveQuest(location.id), getRules()]);
		try {
			await postMessage(
				location.id,
				{ userId: user.id, characterId: character.id, capabilities: user.capabilities },
				parsed,
				{ questId: quest?.id ?? null, diceOutsideQuest: rules.diceOutsideQuest }
			);
		} catch (e) {
			if (e instanceof ChatError) return fail(400, { error: e.message });
			throw e;
		}
		return { sent: true };
	},

	/** Prova di abilità o caratteristica: disponibile solo durante una quest. */
	prova: async (event) => {
		const { user, character } = requireCharacter(event);
		const location = await loadPlayable(event.params.id);
		const quest = await getActiveQuest(location.id);
		if (!quest) return fail(400, { error: 'Le prove si fanno solo durante una quest: nel gioco libero si descrive.' });

		const me = await getCharacter(character.id);
		if (!me?.statsAllocated) {
			return fail(400, { error: 'Prima distribuisci i punti iniziali nella tua scheda.' });
		}

		const form = await event.request.formData();
		const [type, rawId] = String(form.get('target') ?? '').split(':');
		const id = Number(rawId);
		if (!Number.isInteger(id) || id <= 0 || (type !== 'skill' && type !== 'stat')) {
			return fail(400, { error: 'Scegli un’abilità o una caratteristica.' });
		}
		const values = await checkValues(character.id, type === 'skill' ? { skillId: id } : { statId: id });
		if (!values) return fail(400, { error: 'Abilità o caratteristica non trovata.' });

		const rules = await getRules();
		const result = computeCheck({ die: rules.questDie, roll: randomInt(1, rules.questDie + 1), ...values });
		try {
			await postCheck(location.id, { userId: user.id, characterId: character.id, capabilities: user.capabilities }, quest.id, result);
		} catch (e) {
			if (e instanceof ChatError) return fail(400, { error: e.message });
			throw e;
		}
		return { sent: true };
	},

	avviaQuest: async (event) => {
		const { user, character } = requireCharacter(event);
		if (!user.capabilities.has('chat.master')) error(403, 'Solo un Master può avviare una quest.');
		const location = await loadPlayable(event.params.id);
		const form = await event.request.formData();
		const parsed = z.string().trim().min(3, 'Dai un titolo alla quest (almeno 3 caratteri).').max(100).safeParse(form.get('title'));
		if (!parsed.success) return fail(400, { questError: parsed.error.issues[0].message });

		try {
			const quest = await startQuest(location.id, parsed.data, user.id, character.id);
			await postSystem(location.id, `Inizia la quest «${quest.title}». Master: ${fullName(character)}.`, quest.id);
			broadcastQuestChanged(location.id);
			await audit({
				actorUserId: user.id,
				action: 'quest.start',
				targetType: 'quest',
				targetId: quest.id,
				details: { titolo: quest.title, luogo: location.name },
				ip: clientIp(event)
			});
		} catch (e) {
			if (e instanceof QuestError) return fail(400, { questError: e.message });
			throw e;
		}
		return { questStarted: true };
	},

	terminaQuest: async (event) => {
		const { user } = requireCharacter(event);
		if (!user.capabilities.has('chat.master')) error(403, 'Solo un Master può chiudere una quest.');
		const location = await loadPlayable(event.params.id);
		const active = await getActiveQuest(location.id);
		if (!active) return fail(400, { questError: 'Non c’è nessuna quest in corso.' });

		const ended = await endQuest(active.id);
		if (!ended) return fail(400, { questError: 'La quest è già stata chiusa.' });
		await postSystem(location.id, `Si conclude la quest «${ended.title}». Si torna al gioco libero.`, ended.id);
		broadcastQuestChanged(location.id);
		await audit({
			actorUserId: user.id,
			action: 'quest.end',
			targetType: 'quest',
			targetId: ended.id,
			details: { titolo: ended.title, luogo: location.name },
			ip: clientIp(event)
		});
		if (user.capabilities.has('xp.award')) redirect(303, `/gioco/quest/${ended.id}`);
		return { questEnded: true };
	},

	nascondi: async (event) => moderate(event, true),
	ripristina: async (event) => moderate(event, false)
};

async function moderate(event: RequestEvent, hidden: boolean) {
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
