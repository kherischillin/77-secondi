import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { createJob, deleteJob, JobError, listJobs, updateJob } from '#lib/server/jobs.ts';
import { getEconomy } from '#lib/server/settings.ts';
import { readJobForm } from '#lib/jobs.ts';
import { fieldErrors } from '#lib/validation.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'economy.manage');
	const [jobs, economy] = await Promise.all([listJobs(true), getEconomy()]);
	return { jobs, currency: economy.currencyName, intervalHours: economy.salaryIntervalHours };
};

export const actions: Actions = {
	crea: async (event) => {
		const { user } = requireCapability(event, 'economy.manage');
		const parsed = readJobForm(await event.request.formData());
		if (!parsed.success) return fail(400, { action: 'crea', errors: fieldErrors(parsed.error) });
		try {
			const job = await createJob(parsed.data);
			await audit({ actorUserId: user.id, action: 'job.create', targetType: 'job', targetId: job.id, details: { nome: job.name, paga: job.pay }, ip: clientIp(event) });
			return { action: 'crea', success: `Lavoro "${job.name}" creato.` };
		} catch (e) {
			if (e instanceof JobError) return fail(400, { action: 'crea', errors: { name: e.message } as Record<string, string> });
			throw e;
		}
	},
	modifica: async (event) => {
		const { user } = requireCapability(event, 'economy.manage');
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const parsed = readJobForm(form);
		if (!parsed.success) return fail(400, { action: 'modifica', id, error: parsed.error.issues[0].message });
		try {
			const job = await updateJob(id, parsed.data);
			if (!job) return fail(404, { action: 'modifica', id, error: 'Lavoro non trovato.' });
			await audit({ actorUserId: user.id, action: 'job.update', targetType: 'job', targetId: job.id, details: { nome: job.name, paga: job.pay, aperto: job.isOpen }, ip: clientIp(event) });
			return { action: 'modifica', id, success: `Lavoro "${job.name}" salvato.` };
		} catch (e) {
			if (e instanceof JobError) return fail(400, { action: 'modifica', id, error: e.message });
			throw e;
		}
	},
	elimina: async (event) => {
		const { user } = requireCapability(event, 'economy.manage');
		const id = Number((await event.request.formData()).get('id'));
		const job = await deleteJob(id);
		if (!job) return fail(404, { action: 'elimina', id, error: 'Lavoro non trovato.' });
		await audit({ actorUserId: user.id, action: 'job.delete', targetType: 'job', targetId: job.id, details: { nome: job.name }, ip: clientIp(event) });
		return { action: 'elimina', success: `Lavoro "${job.name}" cancellato: chi lo faceva ora non ha un'occupazione.` };
	}
};
