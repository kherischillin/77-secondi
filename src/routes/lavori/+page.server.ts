import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { currentJob, JobError, jobPay, leaveJob, listJobs, takeJob } from '#lib/server/jobs.ts';
import { balances } from '#lib/server/money.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { fullName } from '#lib/format.ts';

export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const economy = await getEconomy();
	const [jobs, mine, pay, purse] = await Promise.all([
		listJobs(),
		currentJob(character.id),
		jobPay(character.id, economy.salaryIntervalHours),
		balances(character.id)
	]);
	return {
		me: { name: fullName(character) },
		jobs,
		current: mine ? { id: mine.job.id, name: mine.job.name, icon: mine.job.icon, isOpen: mine.job.isOpen } : null,
		pay,
		purse,
		currency: economy.currencyName,
		intervalHours: economy.salaryIntervalHours
	};
};

export const actions: Actions = {
	scegli: async (event) => {
		const { character } = requireCharacter(event);
		const id = Number((await event.request.formData()).get('jobId'));
		try {
			const job = await takeJob(character.id, id);
			return { success: `Ora lavori come: ${job.name}.` };
		} catch (e) {
			if (e instanceof JobError) return fail(400, { error: e.message });
			throw e;
		}
	},
	lascia: async (event) => {
		const { character } = requireCharacter(event);
		await leaveJob(character.id);
		return { success: 'Hai lasciato il lavoro.' };
	}
};
