import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireUser, clientIp } from '#lib/server/guards.ts';
import {
	GiocataError,
	canReadGiocata,
	characterIdsOf,
	deleteGiocata,
	getGiocata,
	giocataView,
	requestReview,
	reviewGiocata,
	setPublic
} from '#lib/server/giocate.ts';
import { giocataParticipants } from '#lib/master.ts';
import { audit } from '#lib/server/audit.ts';

async function context(event: Pick<RequestEvent, 'locals' | 'url' | 'params'>) {
	const { user } = requireUser(event);
	const g = await getGiocata(Number(event.params.id));
	// Una giocata privata non accessibile risponde "non trovata".
	if (!g || !(await canReadGiocata(g, user))) error(404, 'Giocata non trovata.');
	const mine = await characterIdsOf(user.id);
	const isParticipant = g.participantIds.some((id) => mine.includes(id));
	return {
		user,
		g,
		mine,
		isOwner: g.createdByUserId === user.id,
		isParticipant,
		isReviewer: user.capabilities.has('giocate.review')
	};
}

export const load: PageServerLoad = async (event) => {
	const { g, mine, isOwner, isParticipant, isReviewer } = await context(event);
	const view = giocataView(g);
	const participants = giocataParticipants(view.messages);
	return {
		giocata: view,
		participants: {
			players: participants.players.map((p) => ({ ...p, mine: mine.includes(p.id) })),
			masters: participants.masters
		},
		can: {
			togglePublic: isOwner,
			requestReview: (isOwner || isParticipant) && !view.reviewRequestedAt,
			review: isReviewer && !!view.reviewRequestedAt && !view.reviewedAt,
			delete: (isOwner && !view.reviewedAt) || isReviewer
		}
	};
};

export const actions: Actions = {
	pubblica: async (event) => {
		const { g, isOwner } = await context(event);
		if (!isOwner) error(403, 'Solo chi l’ha registrata può cambiarne la visibilità.');
		await setPublic(g.id, !g.isPublic);
		return { success: g.isPublic ? 'Ora la giocata è visibile solo a partecipanti e Master.' : 'Ora la giocata è pubblica.' };
	},

	inviaMaster: async (event) => {
		const { user, g, isOwner, isParticipant } = await context(event);
		if (!isOwner && !isParticipant) error(403, 'Solo i partecipanti possono inviarla ai Master.');
		await requestReview(g.id);
		await audit({ actorUserId: user.id, action: 'giocata.review_request', targetType: 'giocata', targetId: g.id, details: { titolo: g.title }, ip: clientIp(event) });
		return { success: 'Giocata inviata ai Master per la revisione.' };
	},

	rivedi: async (event) => {
		const { user, g, isReviewer } = await context(event);
		if (!isReviewer) error(403, 'Solo i Master revisori possono farlo.');
		const form = await event.request.formData();
		const note = String(form.get('note') ?? '').trim().slice(0, 2000);
		const amount = z.coerce.number().int().min(0).max(1000);
		const awards: { characterId: number; amount: number }[] = [];
		for (const id of g.participantIds) {
			const parsed = amount.safeParse(form.get(`px_${id}`) ?? 0);
			if (!parsed.success) return fail(400, { error: 'I PX devono essere numeri tra 0 e 1000.' });
			awards.push({ characterId: id, amount: parsed.data });
		}
		try {
			await reviewGiocata(g.id, { userId: user.id }, note, awards, g.title);
		} catch (e) {
			if (e instanceof GiocataError) return fail(400, { error: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'giocata.review', targetType: 'giocata', targetId: g.id, details: { titolo: g.title, px: awards.filter((a) => a.amount) }, ip: clientIp(event) });
		return { success: 'Revisione salvata.' };
	},

	elimina: async (event) => {
		const { user, g, isOwner, isReviewer } = await context(event);
		if (!(isOwner && !g.reviewedAt) && !isReviewer) error(403, 'Non puoi eliminare questa giocata.');
		await deleteGiocata(g.id);
		await audit({ actorUserId: user.id, action: 'giocata.delete', targetType: 'giocata', targetId: g.id, details: { titolo: g.title }, ip: clientIp(event) });
		redirect(303, '/giocate');
	}
};
