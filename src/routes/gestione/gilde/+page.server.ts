import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { GuildError, createGuild, listGuilds } from '#lib/server/guilds.ts';
import { saveImage, UploadError } from '#lib/server/uploads.ts';
import { audit } from '#lib/server/audit.ts';
import { fieldErrors } from '#lib/validation.ts';
import { guildFormSchema } from '#lib/social.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'guilds.manage');
	return { guilds: await listGuilds(true) };
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireCapability(event, 'guilds.manage');
		const form = await event.request.formData();
		const values = {
			name: String(form.get('name') ?? ''),
			category: String(form.get('category') ?? ''),
			description: String(form.get('description') ?? ''),
			joinMode: String(form.get('joinMode') ?? 'apply'),
			icon: String(form.get('icon') ?? 'shield')
		};
		const parsed = guildFormSchema.safeParse(values);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });

		let symbol: string | null;
		try {
			symbol = await saveImage(form.get('symbol'));
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { errors: { symbol: e.message } as Record<string, string>, values });
			throw e;
		}

		let guild;
		try {
			guild = await createGuild({ ...parsed.data, symbol });
		} catch (e) {
			if (e instanceof GuildError) return fail(400, { errors: { name: e.message } as Record<string, string>, values });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'guild.create', targetType: 'guild', targetId: guild.id, details: { nome: guild.name }, ip: clientIp(event) });
		redirect(303, `/gestione/gilde/${guild.id}?nuova=1`);
	}
};
