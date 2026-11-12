import { error, fail, redirect } from '@sveltejs/kit';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { getLocation, getMap, getStartMap, toLocationView } from '#lib/server/world.ts';
import { enterLocation, listPresentAt } from '#lib/server/presence.ts';
import { ChatError, characterPostTimes, loadHistory, postCheck, postMessage, postSystem, setHidden } from '#lib/server/chat-service.ts';
import { currentScene, LEAD_OPTIONS, leadLabel, recordWindow } from '#lib/scene.ts';
import { parseChatInput, type ChosenKind } from '#lib/chat.ts';
import { audit } from '#lib/server/audit.ts';
import { getRules } from '#lib/server/settings.ts';
import { endQuest, getActiveQuest, QuestError, startQuest } from '#lib/server/quests.ts';
import { broadcastQuestChanged } from '#lib/server/realtime.ts';
import { checkValues, getCharacter, listSkills, listStats } from '#lib/server/sheet.ts';
import { computeCheck } from '#lib/rules.ts';
import { fullName } from '#lib/format.ts';
import { createGiocata, GiocataError, recentQuest } from '#lib/server/giocate.ts';
import { giocataSchema } from '#lib/master.ts';
import { activeBooking, bookingView, bookRoom, extendBooking, invite, releaseBooking, roomAccess, RoomError, sendRoomInvite, uninvite, isRoomsOnlyMap } from '#lib/server/rooms.ts';
import { disconnect } from '#lib/server/realtime.ts';
import { balances } from '#lib/server/money.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { inventory, ItemError, useItem } from '#lib/server/items.ts';
import { canPostNow, postItemUse } from '#lib/server/chat-service.ts';
import { weatherFor } from '#lib/weather.ts';
import { MAX_TAG_LENGTH } from '#lib/chat.ts';

async function findPlayable(idParam: string) {
	const location = await getLocation(Number(idParam));
	if (!location || !location.isActive) error(404, 'Luogo non trovato.');
	if (location.kind === 'map_link') {
		redirect(303, location.linkedMapId ? `/gioco/mappa/${location.linkedMapId}` : '/gioco');
	}
	return location;
}

/** Luogo in cui il personaggio può giocare adesso (stanze private: solo con la prenotazione). */
async function loadPlayable(idParam: string, event?: RequestEvent) {
	const location = await findPlayable(idParam);
	if (event && location.isPrivate) {
		const { user, character } = requireCharacter(event);
		const access = await roomAccess(location, character.id, user.capabilities.has('chat.moderate'));
		if (!access.allowed) error(403, 'Questa stanza privata è prenotata da altri.');
	}
	return location;
}

/** La prenotazione in corso, solo per chi l'ha fatta. */
async function ownBooking(event: RequestEvent) {
	const { character } = requireCharacter(event);
	const location = await findPlayable(event.params.id);
	const booking = await activeBooking(location.id);
	if (!booking || booking.ownerCharacterId !== character.id) error(403, 'Solo chi ha prenotato la stanza può farlo.');
	return { location, booking, character };
}

export const load: PageServerLoad = async (event) => {
	const { user, character } = requireCharacter(event);
	const location = await findPlayable(event.params.id);
	const map = await getMap(location.mapId);
	const canModerate = user.capabilities.has('chat.moderate');
	const access = await roomAccess(location, character.id, canModerate);
	const weather = map ? weatherFor(map, new Date()) : null;
	const room = location.isPrivate
		? {
				hourlyPrice: location.hourlyPrice,
				maxHours: location.maxHours,
				booking: access.booking ? await bookingView(access.booking) : null,
				isOwner: access.isOwner,
				currency: (await getEconomy()).currencyName,
				cash: (await balances(character.id)).money
			}
		: null;

	// Stanza privata prenotata da altri: chi non è invitato torna alla mappa principale con un avviso.
	if (!access.allowed && access.booking) {
		const back = (await getStartMap())?.id ?? location.mapId;
		redirect(303, `/gioco/mappa/${back}?stanza-occupata=${location.id}`);
	}
	// Stanza privata libera: si mostra solo il modulo di prenotazione.
	if (!access.allowed) {
		return { locked: true as const, location: toLocationView(location), map: map ? { id: map.id, name: map.name } : null, weather, room };
	}

	await enterLocation(character.id, location.mapId, location.id);

	const recentSince = new Date(Date.now() - event.locals.settings.chatVisibleHours * 60 * 60 * 1000);
	const [history, present, quest, rules, stats, skills, me, lastQuest, items, myPosts] = await Promise.all([
		loadHistory(location.id, { characterId: character.id, canModerate, since: access.since, recentSince }),
		listPresentAt(location.id),
		getActiveQuest(location.id),
		getRules(),
		listStats(),
		listSkills(),
		getCharacter(character.id),
		recentQuest(location.id),
		inventory(character.id),
		characterPostTimes(location.id, character.id, access.since)
	]);
	const scene = currentScene(myPosts);

	return {
		locked: false as const,
		weather,
		room,
		usableItems: items.map((i) => ({ id: i.id, name: i.item.name, quantity: i.quantity, consumable: i.item.consumable, equipped: i.equipped })),
		location: toLocationView(location),
		map: map ? { id: map.id, name: map.name } : null,
		history,
		present,
		me: character.id,
		quest,
		questDie: rules.questDie,
		diceAllowed: !!quest || rules.diceOutsideQuest,
		statsAllocated: me?.statsAllocated ?? false,
		chatVisibleHours: event.locals.settings.chatVisibleHours,
		recordScene: scene
			? { first: scene.first.toISOString(), options: LEAD_OPTIONS.map((m) => ({ value: m, label: leadLabel(m) })) }
			: null,
		recordableQuest: lastQuest ? { id: lastQuest.id, title: lastQuest.title, active: !lastQuest.endedAt } : null,
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
		const location = await loadPlayable(event.params.id, event);
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
		const location = await loadPlayable(event.params.id, event);
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
		const location = await loadPlayable(event.params.id, event);
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
		const location = await loadPlayable(event.params.id, event);
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

	/** Registra la giocata: copia permanente di un tratto di chat. */
	registra: async (event) => {
		const { user, character } = requireCharacter(event);
		const location = await loadPlayable(event.params.id, event);
		const form = await event.request.formData();
		const parsed = giocataSchema.safeParse({ title: String(form.get('title') ?? ''), isPublic: form.get('isPublic') === 'on' });
		if (!parsed.success) return fail(400, { recordError: parsed.error.issues[0].message });

		const span = String(form.get('span') ?? '0');
		let range: { from: Date; to: Date } | { questId: number };
		if (span.startsWith('quest:')) {
			const quest = await recentQuest(location.id);
			if (!quest || quest.id !== Number(span.slice(6))) return fail(400, { recordError: 'Quest non trovata.' });
			range = { questId: quest.id };
		} else {
			// La giocata parte dal primo messaggio del personaggio nella sua scena, anticipabile al massimo di 3 ore.
			const since = location.isPrivate ? (await roomAccess(location, character.id, true)).since : null;
			const scene = currentScene(await characterPostTimes(location.id, character.id, since));
			if (!scene) return fail(400, { recordError: 'Il tuo personaggio non ha ancora scritto in questo luogo: non c’è niente da registrare.' });
			const window = recordWindow(scene, Number(span));
			if (!window) return fail(400, { recordError: 'Si può partire al massimo 3 ore prima del tuo primo messaggio.' });
			range = window;
		}

		let giocata;
		try {
			giocata = await createGiocata({
				location: { id: location.id, name: location.name },
				range,
				title: parsed.data.title,
				isPublic: parsed.data.isPublic,
				creator: { userId: user.id, characterId: character.id, isReviewer: user.capabilities.has('giocate.review') },
				since: location.isPrivate ? (await roomAccess(location, character.id, true)).since : null
			});
		} catch (e) {
			if (e instanceof GiocataError) return fail(400, { recordError: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'giocata.create', targetType: 'giocata', targetId: giocata.id, details: { titolo: giocata.title, luogo: location.name }, ip: clientIp(event) });
		redirect(303, `/giocate/${giocata.id}`);
	},

	/** Usa (o mostra) un oggetto dell'inventario: compare in chat; i consumabili si esauriscono. */
	usa: async (event) => {
		const { user, character } = requireCharacter(event);
		const location = await loadPlayable(event.params.id, event);
		const form = await event.request.formData();
		const id = Number(form.get('itemId'));
		const text = String(form.get('text') ?? '').trim().slice(0, 2000);
		const tag = String(form.get('tag') ?? '').trim().slice(0, MAX_TAG_LENGTH) || null;
		if (!Number.isInteger(id) || id <= 0) return fail(400, { itemError: 'Scegli un oggetto.' });
		if (!canPostNow(character.id)) return fail(400, { itemError: 'Stai scrivendo troppo in fretta: aspetta qualche secondo.' });
		try {
			const { item, consumed } = await useItem(character.id, id);
			const quest = await getActiveQuest(location.id);
			await postItemUse(
				location.id,
				{ userId: user.id, characterId: character.id, capabilities: user.capabilities },
				quest?.id ?? null,
				{ id: item.id, name: item.name, description: item.description, consumed },
				text,
				tag
			);
		} catch (e) {
			if (e instanceof ItemError || e instanceof ChatError) return fail(400, { itemError: e.message });
			throw e;
		}
		return { itemUsed: true };
	},

	// --- Stanze private ---------------------------------------------------

	prenota: async (event) => {
		const { user, character } = requireCharacter(event);
		const location = await findPlayable(event.params.id);
		const hours = Number((await event.request.formData()).get('hours'));
		try {
			const { cost } = await bookRoom(location, character.id, hours);
			// Chi era rimasto collegato alla stanza (moderatori, vecchi invitati) ricontrolla l'accesso.
			disconnect(location.id, (id) => id !== character.id);
			await audit({ actorUserId: user.id, action: 'room.book', targetType: 'location', targetId: location.id, details: { luogo: location.name, ore: hours, costo: cost, personaggio: character.name }, ip: clientIp(event) });
		} catch (e) {
			if (e instanceof RoomError) return fail(400, { roomError: e.message });
			throw e;
		}
		return { roomSuccess: 'Stanza prenotata. Puoi invitare altri personaggi.' };
	},

	prolunga: async (event) => {
		const { location, booking } = await ownBooking(event);
		const hours = Number((await event.request.formData()).get('hours'));
		try {
			await extendBooking(location, booking, hours);
		} catch (e) {
			if (e instanceof RoomError) return fail(400, { roomError: e.message });
			throw e;
		}
		return { roomSuccess: 'Prenotazione prolungata.' };
	},

	invita: async (event) => {
		const { booking, location, character } = await ownBooking(event);
		const { user } = requireCharacter(event);
		const name = String((await event.request.formData()).get('name') ?? '');
		try {
			const c = await invite(booking, name);
			// L'invitato riceve una missiva con il collegamento per entrare.
			const sent = await sendRoomInvite({ ...character, userId: user.id }, c, location, booking);
			return { roomSuccess: `${c.name} può entrare nella stanza${sent ? ' e ha ricevuto una missiva con l’invito' : ''}.`, location: location.id };
		} catch (e) {
			if (e instanceof RoomError) return fail(400, { roomError: e.message });
			throw e;
		}
	},

	rimuovi: async (event) => {
		const { booking, location } = await ownBooking(event);
		const id = Number((await event.request.formData()).get('characterId'));
		await uninvite(booking, id);
		disconnect(location.id, (c) => c === id);
		return { roomSuccess: 'Invito ritirato.' };
	},

	libera: async (event) => {
		const { booking, location } = await ownBooking(event);
		await releaseBooking(booking);
		disconnect(location.id);
		redirect(303, (await isRoomsOnlyMap(location.mapId)) ? '/stanze-private' : `/gioco/mappa/${location.mapId}`);
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
