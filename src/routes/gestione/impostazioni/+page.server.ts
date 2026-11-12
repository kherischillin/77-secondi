import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { getSettings, settingsSchema, updateSettings } from '#lib/server/settings.ts';
import { audit } from '#lib/server/audit.ts';
import { fieldErrors } from '#lib/validation.ts';
import { parseHostList } from '#lib/portrait.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'settings.manage');
	return { current: await getSettings() };
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireCapability(event, 'settings.manage');
		const form = await event.request.formData();
		const hostList = parseHostList(String(form.get('portraitHosts') ?? ''));
		if (hostList.invalid.length) {
			return fail(400, { errors: { portraitHosts: `Non sono nomi di siti validi: ${hostList.invalid.slice(0, 5).join(', ')}` } as Record<string, string> });
		}
		const parsed = settingsSchema.safeParse({
			siteName: String(form.get('siteName') ?? ''),
			siteTagline: String(form.get('siteTagline') ?? ''),
			registrationsOpen: form.get('registrationsOpen') === 'on',
			maxCharactersPerUser: Number(form.get('maxCharactersPerUser')),
			maxGuildsPerCharacter: Number(form.get('maxGuildsPerCharacter')),
			theme: String(form.get('theme') ?? 'taverna'),
			customCss: String(form.get('customCss') ?? '').replace(/\r\n/g, '\n'),
			portraitHosts: hostList.hosts,
			portraitMaxWidth: Number(form.get('portraitMaxWidth')),
			portraitMaxHeight: Number(form.get('portraitMaxHeight'))
		});
		if (!parsed.success) {
			return fail(400, { errors: fieldErrors(parsed.error) });
		}
		await updateSettings(parsed.data);
		await audit({
			actorUserId: user.id,
			action: 'settings.update',
			details: { ...parsed.data, customCss: parsed.data.customCss ? `${parsed.data.customCss.length} caratteri` : '' },
			ip: clientIp(event)
		});
		return { success: true };
	}
};
