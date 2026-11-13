import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { clientIp, requireCapability } from '#lib/server/guards.ts';
import { getHome, updateHome } from '#lib/server/settings.ts';
import { createNews, deleteNews, getNews, listNews, updateNews } from '#lib/server/news.ts';
import { deleteImage, mediaUrl, saveImage, UploadError } from '#lib/server/uploads.ts';
import { audit } from '#lib/server/audit.ts';
import { homeSchema, readNewsForm } from '#lib/home.ts';

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'home.manage');
	const [home, news] = await Promise.all([getHome(), listNews({ publishedOnly: false })]);
	return {
		home: { ...home, backgroundUrl: mediaUrl(home.background) },
		news: news.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() }))
	};
};

function newsId(form: FormData) {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	benvenuto: async (event) => {
		const { user } = requireCapability(event, 'home.manage');
		const form = await event.request.formData();
		const current = await getHome();
		let background = current.background;
		try {
			const uploaded = await saveImage(form.get('background'));
			if (uploaded) background = uploaded;
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { action: 'benvenuto', error: e.message });
			throw e;
		}
		if (form.get('removeBackground') === 'on') background = null;
		const parsed = homeSchema.safeParse({
			chapter: String(form.get('chapter') ?? ''),
			welcomeTitle: String(form.get('welcomeTitle') ?? ''),
			welcomeText: String(form.get('welcomeText') ?? ''),
			presentLine: String(form.get('presentLine') ?? ''),
			background
		});
		if (!parsed.success) {
			if (background !== current.background) await deleteImage(background);
			return fail(400, { action: 'benvenuto', error: 'Testi troppo lunghi: controlla i limiti indicati.' });
		}
		await updateHome(parsed.data);
		if (background !== current.background) await deleteImage(current.background);
		await audit({ actorUserId: user.id, action: 'home.update', ip: clientIp(event) });
		return { action: 'benvenuto', success: 'Pagina iniziale salvata.' };
	},

	nuovaNews: async (event) => {
		const { user } = requireCapability(event, 'home.manage');
		const parsed = readNewsForm(await event.request.formData());
		if (!parsed.success) return fail(400, { action: 'nuovaNews', error: parsed.error.issues[0].message });
		const n = await createNews(parsed.data, user.id);
		await audit({ actorUserId: user.id, action: 'news.create', targetType: 'news', targetId: n.id, details: { titolo: n.title }, ip: clientIp(event) });
		return { action: 'nuovaNews', success: `News «${n.title}» pubblicata.` };
	},

	salvaNews: async (event) => {
		const { user } = requireCapability(event, 'home.manage');
		const form = await event.request.formData();
		const id = newsId(form);
		if (!id || !(await getNews(id))) error(404, 'News non trovata.');
		const parsed = readNewsForm(form);
		if (!parsed.success) return fail(400, { action: 'salvaNews', id, error: parsed.error.issues[0].message });
		const n = await updateNews(id, parsed.data);
		await audit({ actorUserId: user.id, action: 'news.update', targetType: 'news', targetId: id, details: { titolo: n?.title }, ip: clientIp(event) });
		return { action: 'salvaNews', id, success: 'News salvata.' };
	},

	eliminaNews: async (event) => {
		const { user } = requireCapability(event, 'home.manage');
		const id = newsId(await event.request.formData());
		const n = id ? await deleteNews(id) : null;
		if (!n) error(404, 'News non trovata.');
		await audit({ actorUserId: user.id, action: 'news.delete', targetType: 'news', targetId: n.id, details: { titolo: n.title }, ip: clientIp(event) });
		return { action: 'eliminaNews', success: `News «${n.title}» cancellata.` };
	}
};
