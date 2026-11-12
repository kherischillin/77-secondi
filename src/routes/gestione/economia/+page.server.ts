import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { getEconomy, updateEconomy } from '#lib/server/settings.ts';
import { balances, findCharacterByName, listRankSalaries, moneyHistory, MoneyError, setRankSalary, staffAdjust } from '#lib/server/money.ts';
import { economySchema, MAX_AMOUNT } from '#lib/economy.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';
import { fullName } from '#lib/format.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'economy.manage');
	const [economy, ranks] = await Promise.all([getEconomy(), listRankSalaries()]);

	// Consultazione del denaro di un personaggio (?pg=Nome).
	const wanted = event.url.searchParams.get('pg')?.trim() ?? '';
	let lookup = null;
	if (wanted) {
		const c = await findCharacterByName(wanted);
		lookup = c
			? { found: true as const, name: fullName(c), ...(await balances(c.id)), history: await moneyHistory(c.id, 30) }
			: { found: false as const, name: wanted };
	}
	return { economy, ranks, lookup };
};

const adjustSchema = z.object({
	to: z.string().trim().min(1, 'Scrivi il nome del personaggio.'),
	account: z.enum(['cash', 'bank']),
	amount: z.coerce
		.number({ error: 'Scrivi un importo.' })
		.int('Solo numeri interi.')
		.min(-MAX_AMOUNT)
		.max(MAX_AMOUNT)
		.refine((n) => n !== 0, 'L’importo non può essere zero.'),
	note: z.string().trim().min(3, 'Scrivi il motivo (almeno 3 caratteri).').max(200)
});

export const actions: Actions = {
	impostazioni: async (event) => {
		const { user } = requireCapability(event, 'economy.manage');
		const form = await event.request.formData();
		const parsed = economySchema.safeParse({
			currencyName: String(form.get('currencyName') ?? ''),
			startingMoney: Number(form.get('startingMoney')),
			sellbackPercent: Number(form.get('sellbackPercent')),
			salaryIntervalHours: Number(form.get('salaryIntervalHours'))
		});
		if (!parsed.success) return fail(400, { action: 'impostazioni', errors: fieldErrors(parsed.error) });
		await updateEconomy(parsed.data);
		await audit({ actorUserId: user.id, action: 'economy.update', details: parsed.data, ip: clientIp(event) });
		return { action: 'impostazioni', success: 'Impostazioni salvate.' };
	},

	stipendio: async (event) => {
		const { user } = requireCapability(event, 'economy.manage');
		const form = await event.request.formData();
		const salary = Number(form.get('salary'));
		if (!Number.isInteger(salary) || salary < 0 || salary > MAX_AMOUNT) return fail(400, { action: 'stipendio', error: 'Stipendio non valido.' });
		const rank = await setRankSalary(Number(form.get('rankId')), salary);
		if (!rank) return fail(404, { action: 'stipendio', error: 'Grado non trovato.' });
		await audit({ actorUserId: user.id, action: 'economy.salary', targetType: 'guild_rank', targetId: rank.id, details: { grado: rank.name, stipendio: salary }, ip: clientIp(event) });
		return { action: 'stipendio', success: `Stipendio di "${rank.name}" aggiornato.` };
	},

	correggi: async (event) => {
		const { user } = requireCapability(event, 'economy.manage');
		const form = await event.request.formData();
		const values = {
			to: String(form.get('to') ?? ''),
			account: String(form.get('account') ?? 'cash'),
			amount: form.get('amount'),
			note: String(form.get('note') ?? '')
		};
		const parsed = adjustSchema.safeParse(values);
		if (!parsed.success) return fail(400, { action: 'correggi', errors: fieldErrors(parsed.error) });
		const target = await findCharacterByName(parsed.data.to);
		if (!target) return fail(400, { action: 'correggi', errors: { to: 'Personaggio non trovato.' } as Record<string, string> });
		// Regola anti-abuso: nessuno si dà denaro da solo.
		if (target.userId === user.id) return fail(403, { action: 'correggi', errors: { to: 'Non puoi modificare il denaro dei tuoi personaggi.' } as Record<string, string> });
		try {
			await staffAdjust(target.id, parsed.data.account, parsed.data.amount, parsed.data.note);
		} catch (e) {
			if (e instanceof MoneyError) return fail(400, { action: 'correggi', errors: { amount: e.message } as Record<string, string> });
			throw e;
		}
		await audit({
			actorUserId: user.id,
			action: 'money.staff',
			targetType: 'character',
			targetId: target.id,
			details: { personaggio: target.name, conto: parsed.data.account === 'cash' ? 'contanti' : 'banca', importo: parsed.data.amount, motivo: parsed.data.note },
			ip: clientIp(event)
		});
		return { action: 'correggi', success: `Denaro di ${target.name} aggiornato.` };
	}
};
