import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createReport, ReportError } from '#lib/server/reports.ts';
import { reportSchema } from '#lib/master.ts';
import { isBanned } from '#lib/server/users.ts';
import { audit } from '#lib/server/audit.ts';
import { clientIp } from '#lib/server/guards.ts';

/** Invio di una segnalazione dal pulsante "Segnala" (richiesta JSON dal browser). */
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user || isBanned(user)) return json({ ok: false, message: 'Accedi per segnalare.' }, { status: 401 });

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ ok: false, message: 'Richiesta non valida.' }, { status: 400 });
	}
	const parsed = reportSchema.safeParse(body);
	if (!parsed.success) return json({ ok: false, message: parsed.error.issues[0].message }, { status: 400 });

	try {
		const report = await createReport(event.locals, parsed.data);
		await audit({ actorUserId: user.id, action: 'report.create', targetType: parsed.data.targetType, targetId: parsed.data.targetId, details: { segnalazione: report.id }, ip: clientIp(event) });
		return json({ ok: true, message: 'Segnalazione inviata allo staff. Grazie.' });
	} catch (e) {
		if (e instanceof ReportError) return json({ ok: false, message: e.message }, { status: 400 });
		throw e;
	}
};
