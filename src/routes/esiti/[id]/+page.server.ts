import { error, fail } from '@sveltejs/kit';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireUser, clientIp } from '#lib/server/guards.ts';
import {
	addEsitoMessage,
	assignEsito,
	getEsito,
	listEsitoMessages,
	markEsitoRead,
	setEsitoStatus
} from '#lib/server/esiti.ts';
import { checkValues, listSkills, listStats } from '#lib/server/sheet.ts';
import { getRules } from '#lib/server/settings.ts';
import { computeCheck } from '#lib/rules.ts';
import { esitoReplySchema, judgeCheck } from '#lib/master.ts';
import { audit } from '#lib/server/audit.ts';
import { fullName } from '#lib/format.ts';

/**
 * Chi può vedere l'esito: il giocatore proprietario del personaggio, oppure un Master.
 * Un Master non arbitra le richieste dei propri personaggi: le vede da giocatore.
 */
async function context(event: Pick<RequestEvent, 'locals' | 'url' | 'params'>) {
	const { user } = requireUser(event);
	const row = await getEsito(Number(event.params.id));
	if (!row) error(404, 'Esito non trovato.');
	const isOwner = row.character.userId === user.id;
	const asMaster = !isOwner && user.capabilities.has('esiti.manage');
	if (!isOwner && !asMaster) error(404, 'Esito non trovato.');
	return { user, row, isOwner, asMaster };
}

export const load: PageServerLoad = async (event) => {
	const { user, row, asMaster } = await context(event);
	const [messages, stats, skills, rules] = await Promise.all([
		listEsitoMessages(row.esito.id),
		asMaster ? listStats() : Promise.resolve([]),
		asMaster ? listSkills() : Promise.resolve([]),
		getRules()
	]);
	await markEsitoRead(row.esito.id, asMaster ? 'master' : 'player');
	return {
		esito: {
			id: row.esito.id,
			title: row.esito.title,
			status: row.esito.status,
			master: row.master,
			masterIsMe: row.esito.masterUserId === user.id,
			createdAt: row.esito.createdAt.toISOString()
		},
		character: { id: row.character.id, name: fullName(row.character) },
		messages,
		asMaster,
		questDie: rules.questDie,
		checkOptions: { stats: stats.map((s) => ({ id: s.id, name: s.name })), skills: skills.map((s) => ({ id: s.id, name: s.name })) }
	};
};

export const actions: Actions = {
	rispondi: async (event) => {
		const { user, row, asMaster } = await context(event);
		const form = await event.request.formData();
		const parsed = esitoReplySchema.safeParse({ body: String(form.get('body') ?? ''), offNote: String(form.get('offNote') ?? '') });

		// Prova facoltativa tirata dal Master sui valori del personaggio.
		let check = null;
		const target = String(form.get('target') ?? '');
		if (asMaster && target) {
			const [type, rawId] = target.split(':');
			const id = Number(rawId);
			const values = Number.isInteger(id) ? await checkValues(row.character.id, type === 'skill' ? { skillId: id } : { statId: id }) : null;
			if (!values) return fail(400, { error: 'Abilità o caratteristica non valida.' });
			const diffRaw = String(form.get('difficulty') ?? '').trim();
			const difficulty = diffRaw === '' ? null : Number(diffRaw);
			if (difficulty !== null && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 1000)) {
				return fail(400, { error: 'La difficoltà deve essere un numero intero tra 1 e 1000.' });
			}
			const rules = await getRules();
			check = judgeCheck(computeCheck({ die: rules.questDie, roll: randomInt(1, rules.questDie + 1), ...values }), difficulty);
		}

		if (!parsed.success && !check) return fail(400, { error: parsed.error.issues[0].message });
		await addEsitoMessage(
			row.esito.id,
			{ userId: user.id, fromMaster: asMaster },
			{ body: parsed.success ? parsed.data.body : '', offNote: parsed.success ? parsed.data.offNote : '', check }
		);
		if (asMaster) {
			await audit({ actorUserId: user.id, action: 'esito.reply', targetType: 'esito', targetId: row.esito.id, details: { titolo: row.esito.title, prova: check ? `${check.total}${check.difficulty ? ` vs ${check.difficulty}` : ''}` : null }, ip: clientIp(event) });
		}
		return { sent: true };
	},

	prendi: async (event) => {
		const { user, row, asMaster } = await context(event);
		if (!asMaster) error(403, 'Solo i Master possono prendere in carico un esito.');
		await assignEsito(row.esito.id, user.id);
		await audit({ actorUserId: user.id, action: 'esito.assign', targetType: 'esito', targetId: row.esito.id, details: { titolo: row.esito.title }, ip: clientIp(event) });
		return { assigned: true };
	},

	lascia: async (event) => {
		const { user, row, asMaster } = await context(event);
		if (!asMaster || row.esito.masterUserId !== user.id) error(403, 'Puoi lasciare solo gli esiti di cui ti occupi.');
		await assignEsito(row.esito.id, null);
		return { assigned: false };
	},

	chiudi: async (event) => statusAction(event, 'closed'),
	riapri: async (event) => statusAction(event, 'open')
};

async function statusAction(event: RequestEvent, status: 'open' | 'closed') {
	const { user, row, asMaster, isOwner } = await context(event);
	// Chiude il Master; il giocatore può riaprire solo se vuole aggiungere qualcosa (lo fa rispondendo).
	if (!asMaster && !(isOwner && status === 'closed')) error(403, 'Non puoi farlo.');
	z.enum(['open', 'closed']).parse(status);
	await setEsitoStatus(row.esito.id, status);
	await audit({ actorUserId: user.id, action: status === 'closed' ? 'esito.close' : 'esito.reopen', targetType: 'esito', targetId: row.esito.id, details: { titolo: row.esito.title }, ip: clientIp(event) });
	return { status };
}
