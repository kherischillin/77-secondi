import { fail } from '@sveltejs/kit';
import { gunzipSync } from 'node:zlib';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { DumpError, parseDump } from '#lib/server/import/sql-dump.ts';
import { DEFAULT_STAT_NAMES, GDRCD_TABLES, importOptionsSchema, runImport } from '#lib/server/import/gdrcd.ts';
import { storePending, takePending } from '#lib/server/import/store.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = (event) => {
	requireCapability(event, 'import.run');
	return { defaultStatNames: DEFAULT_STAT_NAMES };
};

const MAX_BYTES = 60 * 1024 * 1024;

export const actions: Actions = {
	/** Legge il file e fa una prova completa dell'importazione, poi la annulla. */
	analizza: async (event) => {
		const { user } = requireCapability(event, 'import.run');
		const form = await event.request.formData();
		const file = form.get('dump');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'Scegli il file .sql esportato dal vecchio gioco.' });
		if (file.size > MAX_BYTES) return fail(400, { error: 'File troppo grande (massimo 60 MB). Esporta il database senza la tabella "chat".' });

		const options = importOptionsSchema.safeParse({
			statNames: [0, 1, 2, 3, 4, 5].map((i) => String(form.get(`stat${i}`) ?? '')),
			pxPerRank: Number(form.get('pxPerRank')),
			messages: form.get('messages') === 'on',
			boards: form.get('boards') === 'on',
			replacePages: form.get('replacePages') === 'on'
		});
		if (!options.success) return fail(400, { error: 'Controlla i nomi delle caratteristiche e il costo in PX per rango.' });

		let buffer = Buffer.from(await file.arrayBuffer());
		if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
			try {
				buffer = gunzipSync(buffer, { maxOutputLength: 200 * 1024 * 1024 });
			} catch {
				return fail(400, { error: 'Il file compresso non si apre (o è più grande di 200 MB).' });
			}
		}
		let tables;
		try {
			tables = parseDump(buffer.toString('utf8'), GDRCD_TABLES);
		} catch (e) {
			if (e instanceof DumpError) return fail(400, { error: `Il file non si legge: ${e.message}` });
			throw e;
		}
		let report;
		try {
			report = await runImport(tables, options.data, user.id, true);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Importazione non riuscita.' });
		}
		const token = storePending({ tables, options: options.data, userId: user.id, fileName: file.name });
		return {
			step: 'anteprima' as const,
			token,
			fileName: file.name,
			tables: [...tables].map(([name, rows]) => ({ name, rows: rows.length })),
			report
		};
	},

	importa: async (event) => {
		const { user } = requireCapability(event, 'import.run');
		const token = String((await event.request.formData()).get('token') ?? '');
		const p = takePending(token, user.id);
		if (!p) return fail(400, { error: 'L’anteprima è scaduta: carica di nuovo il file.' });
		let report;
		try {
			report = await runImport(p.tables, p.options, user.id, false);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Importazione non riuscita: non è stato modificato nulla.' });
		}
		await audit({ actorUserId: user.id, action: 'import.gdrcd', details: { file: p.fileName, ...report.counts }, ip: clientIp(event) });
		return { step: 'fatto' as const, report };
	}
};
