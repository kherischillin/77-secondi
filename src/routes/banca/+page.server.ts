import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter, clientIp } from '#lib/server/guards.ts';
import { balances, claimSalaries, deposit, moneyHistory, MoneyError, salaries, transfer, withdraw } from '#lib/server/money.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { amountSchema } from '#lib/economy.ts';
import { audit } from '#lib/server/audit.ts';
import { fullName } from '#lib/format.ts';
import { RateLimiter } from '#lib/server/rate-limit.ts';

/** Bonifici: al massimo 10 al minuto per personaggio. */
const transferLimiter = new RateLimiter(10, 60_000);

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const economy = await getEconomy();
	const [purse, history, pay] = await Promise.all([
		balances(character.id),
		moneyHistory(character.id),
		salaries(character.id, economy.salaryIntervalHours)
	]);
	return { me: { name: fullName(character) }, purse, history, salaries: pay, currency: economy.currencyName };
};

function readAmount(form: FormData) {
	return amountSchema.safeParse(form.get('amount'));
}

export const actions: Actions = {
	deposita: async (event) => {
		const { character } = requireCharacter(event);
		const amount = readAmount(await event.request.formData());
		if (!amount.success) return fail(400, { error: amount.error.issues[0].message });
		try {
			await deposit(character.id, amount.data);
		} catch (e) {
			if (e instanceof MoneyError) return fail(400, { error: e.message });
			throw e;
		}
		return { success: 'Deposito eseguito.' };
	},
	preleva: async (event) => {
		const { character } = requireCharacter(event);
		const amount = readAmount(await event.request.formData());
		if (!amount.success) return fail(400, { error: amount.error.issues[0].message });
		try {
			await withdraw(character.id, amount.data);
		} catch (e) {
			if (e instanceof MoneyError) return fail(400, { error: e.message });
			throw e;
		}
		return { success: 'Prelievo eseguito.' };
	},
	bonifico: async (event) => {
		const { user, character } = requireCharacter(event);
		const form = await event.request.formData();
		const amount = readAmount(form);
		if (!amount.success) return fail(400, { error: amount.error.issues[0].message, to: String(form.get('to') ?? '') });
		const note = String(form.get('note') ?? '').trim().slice(0, 200);
		const key = String(character.id);
		if (transferLimiter.isLimited(key)) return fail(429, { error: 'Troppi bonifici in poco tempo: riprova tra un minuto.' });
		transferLimiter.hit(key);
		try {
			const to = await transfer(character.id, String(form.get('to') ?? ''), amount.data, note);
			await audit({ actorUserId: user.id, action: 'money.transfer', targetType: 'character', targetId: to.id, details: { da: character.name, a: to.name, importo: amount.data, causale: note }, ip: clientIp(event) });
			return { success: `Bonifico a ${to.name} eseguito.` };
		} catch (e) {
			if (e instanceof MoneyError) return fail(400, { error: e.message, to: String(form.get('to') ?? '') });
			throw e;
		}
	},
	stipendio: async (event) => {
		const { character } = requireCharacter(event);
		const economy = await getEconomy();
		const total = await claimSalaries(character.id, economy.salaryIntervalHours);
		if (total === 0) return fail(400, { error: 'Nessuno stipendio da ritirare adesso.' });
		return { success: `Stipendio accreditato sul conto: ${total.toLocaleString('it-IT', { useGrouping: 'always' })} ${economy.currencyName}.` };
	}
};
