import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { closeReport, listReports, takeReport } from '#lib/server/reports.ts';
import { audit } from '#lib/server/audit.ts';

const STATUSES = ['open', 'in_progress', 'closed'] as const;

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'reports.handle');
	const raw = event.url.searchParams.get('stato');
	const status = (STATUSES as readonly string[]).includes(raw ?? '') ? (raw as (typeof STATUSES)[number]) : 'open';
	return { status, reports: await listReports(status) };
};

export const actions: Actions = {
	prendi: async (event) => {
		const { user } = requireCapability(event, 'reports.handle');
		const id = Number((await event.request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { error: 'Segnalazione non valida.' });
		await takeReport(id, user.id);
		await audit({ actorUserId: user.id, action: 'report.take', targetType: 'report', targetId: id, ip: clientIp(event) });
		return { success: 'Segnalazione presa in carico.' };
	},
	chiudi: async (event) => {
		const { user } = requireCapability(event, 'reports.handle');
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const resolution = String(form.get('resolution') ?? '').trim().slice(0, 2000);
		if (!Number.isInteger(id)) return fail(400, { error: 'Segnalazione non valida.' });
		if (resolution.length < 3) return fail(400, { error: 'Scrivi in breve come è stata gestita.' });
		const r = await closeReport(id, user.id, resolution);
		if (!r) return fail(404, { error: 'Segnalazione non trovata.' });
		await audit({ actorUserId: user.id, action: 'report.close', targetType: 'report', targetId: id, details: { esito: resolution }, ip: clientIp(event) });
		return { success: 'Segnalazione chiusa.' };
	}
};
