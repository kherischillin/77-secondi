import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { claimXpAward, getQuest, questParticipants } from '#lib/server/quests.ts';
import { awardXp } from '#lib/server/sheet.ts';
import { getLocation } from '#lib/server/world.ts';
import { audit } from '#lib/server/audit.ts';

async function loadQuestOr404(id: string) {
	const quest = await getQuest(Number(id));
	if (!quest) error(404, 'Quest non trovata.');
	return quest;
}

export const load: PageServerLoad = async (event) => {
	const { user } = requireCapability(event, 'xp.award');
	const quest = await loadQuestOr404(event.params.id);
	const [participants, location] = await Promise.all([questParticipants(quest.id, user.id), getLocation(quest.locationId)]);
	return {
		quest,
		locationName: location?.name ?? null,
		participants
	};
};

const amountSchema = z.coerce.number().int().min(-1000).max(1000);

export const actions: Actions = {
	assegna: async (event) => {
		const { user } = requireCapability(event, 'xp.award');
		const quest = await loadQuestOr404(event.params.id);
		if (!quest.endedAt) return fail(400, { error: 'Prima chiudi la quest.' });
		if (quest.xpAwardedAt) return fail(400, { error: 'I PX di questa quest sono già stati assegnati.' });

		const form = await event.request.formData();
		const reason = String(form.get('reason') ?? '').trim().slice(0, 200) || `Quest «${quest.title}»`;
		const participants = await questParticipants(quest.id, user.id);

		// Ogni partecipante può ricevere un valore diverso; 0 = nessun PX.
		const awards: { id: number; amount: number }[] = [];
		for (const p of participants) {
			const parsed = amountSchema.safeParse(form.get(`px_${p.id}`) ?? 0);
			if (!parsed.success) return fail(400, { error: `Valore non valido per ${p.name} (tra -1000 e 1000).` });
			if (parsed.data !== 0) awards.push({ id: p.id, amount: parsed.data });
		}

		if (!(await claimXpAward(quest.id))) {
			return fail(400, { error: 'I PX di questa quest sono già stati assegnati.' });
		}
		for (const a of awards) await awardXp([a.id], a.amount, reason, user.id, quest.id);
		await audit({
			actorUserId: user.id,
			action: 'xp.award',
			targetType: 'quest',
			targetId: quest.id,
			details: { motivo: reason, assegnati: awards },
			ip: clientIp(event)
		});
		return { success: true, count: awards.length };
	}
};
