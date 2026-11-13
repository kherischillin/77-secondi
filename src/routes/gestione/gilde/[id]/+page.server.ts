import { error, fail } from '@sveltejs/kit';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { addMemberByCharacter, expel, getGuild, GuildError, leave, listMembers, listRanks, setMemberRank } from '#lib/server/guilds.ts';
import { findCharacterByName } from '#lib/server/money.ts';
import { avatarResolver } from '#lib/server/avatars.ts';
import { fullName } from '#lib/format.ts';
import { deleteImage, mediaUrl, saveImage, UploadError } from '#lib/server/uploads.ts';
import { audit } from '#lib/server/audit.ts';
import { guildFormSchema } from '#lib/social.ts';

async function guildOr404(id: string) {
	const guild = await getGuild(Number(id));
	if (!guild) error(404, 'Gilda non trovata.');
	return guild;
}

const rankSchema = z.object({
	name: z.string().trim().min(2, 'Il nome del grado deve avere almeno 2 caratteri.').max(40),
	level: z.coerce.number().int().min(0).max(1000),
	canManage: z.boolean()
});

function readRank(form: FormData) {
	return rankSchema.safeParse({ name: String(form.get('name') ?? ''), level: form.get('level'), canManage: form.get('canManage') === 'on' });
}

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'guilds.manage');
	const guild = await guildOr404(event.params.id);
	const [ranks, members] = await Promise.all([listRanks(guild.id), listMembers(guild.id)]);
	const avatar = await avatarResolver();
	const counts = await db
		.select({ rankId: schema.guildMembers.rankId, n: sql<number>`count(*)::int` })
		.from(schema.guildMembers)
		.where(eq(schema.guildMembers.guildId, guild.id))
		.groupBy(schema.guildMembers.rankId);
	return {
		guild: { ...guild, symbolUrl: mediaUrl(guild.symbol), createdAt: guild.createdAt.toISOString() },
		ranks: ranks.map((r) => ({ ...r, members: counts.find((c) => c.rankId === r.id)?.n ?? 0 })),
		members: members.map((m) => ({ characterId: m.characterId, name: fullName(m), rankId: m.rankId, avatarUrl: avatar(m.avatar) })),
		isNew: event.url.searchParams.has('nuova')
	};
};

export const actions: Actions = {
	salva: async (event) => {
		const { user } = requireCapability(event, 'guilds.manage');
		const guild = await guildOr404(event.params.id);
		const form = await event.request.formData();
		const parsed = guildFormSchema.safeParse({
			name: String(form.get('name') ?? ''),
			category: String(form.get('category') ?? ''),
			description: String(form.get('description') ?? ''),
			joinMode: String(form.get('joinMode') ?? 'apply'),
			icon: String(form.get('icon') ?? guild.icon)
		});
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });

		const [clash] = await db
			.select({ id: schema.guilds.id })
			.from(schema.guilds)
			.where(and(sql`lower(${schema.guilds.name}) = lower(${parsed.data.name})`, ne(schema.guilds.id, guild.id)));
		if (clash) return fail(400, { error: 'Esiste già una gilda con questo nome.' });

		let symbol = guild.symbol;
		try {
			const uploaded = await saveImage(form.get('symbol'));
			if (uploaded) symbol = uploaded;
		} catch (e) {
			if (e instanceof UploadError) return fail(400, { error: e.message });
			throw e;
		}
		if (form.get('removeSymbol') === 'on') symbol = null;

		await db
			.update(schema.guilds)
			.set({ ...parsed.data, symbol, isActive: form.get('isActive') === 'on' })
			.where(eq(schema.guilds.id, guild.id));
		if (symbol !== guild.symbol) await deleteImage(guild.symbol);
		// La bacheca di gilda segue il nome della gilda.
		await db
			.update(schema.boards)
			.set({ name: `Bacheca: ${parsed.data.name}` })
			.where(and(eq(schema.boards.guildId, guild.id), eq(schema.boards.name, `Bacheca: ${guild.name}`)));
		await audit({ actorUserId: user.id, action: 'guild.update', targetType: 'guild', targetId: guild.id, details: { nome: parsed.data.name }, ip: clientIp(event) });
		return { success: 'Gilda salvata.' };
	},

	nuovoGrado: async (event) => {
		const { user } = requireCapability(event, 'guilds.manage');
		const guild = await guildOr404(event.params.id);
		const parsed = readRank(await event.request.formData());
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		await db.insert(schema.guildRanks).values({ guildId: guild.id, ...parsed.data });
		await audit({ actorUserId: user.id, action: 'guild.update', targetType: 'guild', targetId: guild.id, details: { nuovoGrado: parsed.data.name }, ip: clientIp(event) });
		return { success: `Grado «${parsed.data.name}» creato.` };
	},

	modificaGrado: async (event) => {
		const { user } = requireCapability(event, 'guilds.manage');
		const guild = await guildOr404(event.params.id);
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const parsed = readRank(form);
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		await db
			.update(schema.guildRanks)
			.set(parsed.data)
			.where(and(eq(schema.guildRanks.id, id), eq(schema.guildRanks.guildId, guild.id)));
		await audit({ actorUserId: user.id, action: 'guild.update', targetType: 'guild', targetId: guild.id, details: { grado: parsed.data }, ip: clientIp(event) });
		return { success: `Grado «${parsed.data.name}» salvato.` };
	},

	eliminaGrado: async (event) => {
		const { user } = requireCapability(event, 'guilds.manage');
		const guild = await guildOr404(event.params.id);
		const id = Number((await event.request.formData()).get('id'));
		const [{ n }] = await db
			.select({ n: sql<number>`count(*)::int` })
			.from(schema.guildMembers)
			.where(eq(schema.guildMembers.rankId, id));
		if (n > 0) return fail(400, { error: 'Non puoi eliminare un grado che ha ancora dei membri: spostali prima.' });
		const [{ total }] = await db
			.select({ total: sql<number>`count(*)::int` })
			.from(schema.guildRanks)
			.where(eq(schema.guildRanks.guildId, guild.id));
		if (total <= 1) return fail(400, { error: 'Una gilda deve avere almeno un grado.' });
		await db.delete(schema.guildRanks).where(and(eq(schema.guildRanks.id, id), eq(schema.guildRanks.guildId, guild.id)));
		await audit({ actorUserId: user.id, action: 'guild.update', targetType: 'guild', targetId: guild.id, details: { gradoEliminato: id }, ip: clientIp(event) });
		return { success: 'Grado eliminato.' };
	},

	/** Lo staff mette in gilda un personaggio, con il grado scelto. */
	aggiungiMembro: async (event) => {
		const { user } = requireCapability(event, 'guilds.manage');
		const guild = await guildOr404(event.params.id);
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		const rankId = Number(form.get('rankId'));
		const target = name ? await findCharacterByName(name) : null;
		if (!target) return fail(400, { error: name ? `Nessun personaggio si chiama «${name}».` : 'Scrivi il nome del personaggio.' });
		try {
			await addMemberByCharacter(guild.id, target.id, event.locals.settings.maxGuildsPerCharacter);
			const rank = await setMemberRank(guild.id, { isStaff: true, rank: null }, target.id, rankId);
			await audit({ actorUserId: user.id, action: 'guild.add', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: target.name, grado: rank.name }, ip: clientIp(event) });
			return { success: `${target.name} è entrato in ${guild.name} come ${rank.name}.` };
		} catch (e) {
			if (e instanceof GuildError) {
				// Se il grado non era valido il personaggio è già entrato: lo si toglie, per non lasciarlo a metà.
				if (e.message === 'Grado non valido.') await leave(guild.id, target.id);
				return fail(400, { error: e.message });
			}
			throw e;
		}
	},

	/** Cambio di grado da parte dello staff: qualsiasi grado, a qualsiasi membro. */
	gradoMembro: async (event) => {
		const { user } = requireCapability(event, 'guilds.manage');
		const guild = await guildOr404(event.params.id);
		const form = await event.request.formData();
		const characterId = Number(form.get('characterId'));
		const rankId = Number(form.get('rankId'));
		try {
			const rank = await setMemberRank(guild.id, { isStaff: true, rank: null }, characterId, rankId);
			await audit({ actorUserId: user.id, action: 'guild.rank', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: characterId, grado: rank.name }, ip: clientIp(event) });
			return { success: `Grado aggiornato: ${rank.name}.` };
		} catch (e) {
			if (e instanceof GuildError) return fail(400, { error: e.message });
			throw e;
		}
	},

	togliMembro: async (event) => {
		const { user } = requireCapability(event, 'guilds.manage');
		const guild = await guildOr404(event.params.id);
		const characterId = Number((await event.request.formData()).get('characterId'));
		try {
			await expel(guild.id, { isStaff: true, rank: null }, characterId);
		} catch (e) {
			if (e instanceof GuildError) return fail(400, { error: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'guild.expel', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: characterId }, ip: clientIp(event) });
		return { success: 'Membro tolto dalla gilda.' };
	}
};
