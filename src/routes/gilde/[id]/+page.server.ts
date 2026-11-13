import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireUser, requireCharacter, clientIp } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import {
	GuildError,
	acceptApplication,
	actorFor,
	addMemberByCharacter,
	expel,
	getGuild,
	joinOrApply,
	leave,
	listApplications,
	listMembers,
	listRanks,
	rejectApplication,
	setMemberRank,
	withdrawApplication
} from '#lib/server/guilds.ts';
import { findCharacterByName } from '#lib/server/messages.ts';
import { mediaUrl } from '#lib/server/uploads.ts';
import { currentJob } from '#lib/server/jobs.ts';
import { audit } from '#lib/server/audit.ts';
import { canActOnMember, canAssignRank, canManageGuild } from '#lib/social.ts';

async function guildOr404(id: string) {
	const guild = await getGuild(Number(id));
	if (!guild) error(404, 'Gilda non trovata.');
	return guild;
}

export const load: PageServerLoad = async (event) => {
	const { user } = requireUser(event);
	const guild = await guildOr404(event.params.id);
	const isStaff = user.capabilities.has('guilds.manage');
	if (!guild.isActive && !isStaff) error(404, 'Gilda non trovata.');

	const character = event.locals.character;
	const [ranks, members, actor] = await Promise.all([
		listRanks(guild.id),
		listMembers(guild.id),
		actorFor(guild.id, character?.id ?? null, isStaff)
	]);
	const manage = canManageGuild(actor);
	const applications = manage ? await listApplications(guild.id) : [];

	let myApplication = false;
	if (character && !actor.rank) {
		const [app] = await db
			.select({ id: schema.guildApplications.id })
			.from(schema.guildApplications)
			.where(and(eq(schema.guildApplications.guildId, guild.id), eq(schema.guildApplications.characterId, character.id)));
		myApplication = !!app;
	}

	return {
		guild: {
			id: guild.id,
			name: guild.name,
			category: guild.category,
			description: guild.description,
			statute: guild.statute,
			symbolUrl: mediaUrl(guild.symbol),
			icon: guild.icon,
			joinMode: guild.joinMode,
			isActive: guild.isActive
		},
		ranks: ranks.map((r) => ({ id: r.id, name: r.name, level: r.level, canManage: r.canManage, assignable: canAssignRank(actor, r.level) })),
		members: members.map((m) => ({ ...m, actionable: manage && canActOnMember(actor, m.level) && m.characterId !== character?.id })),
		applications,
		me: {
			hasCharacter: !!character,
			characterName: character?.name ?? null,
			jobName: character ? ((await currentJob(character.id))?.job.name ?? null) : null,
			rankName: actor.rank ? ranks.find((r) => r.level === actor.rank!.level)?.name ?? null : null,
			isMember: !!actor.rank,
			applied: myApplication,
			canManage: manage,
			isStaff
		}
	};
};

/** Azioni dei capi (o dello staff): servono un personaggio attivo con grado da capo, oppure il permesso guilds.manage. */
async function leaderContext(event: RequestEvent) {
	const { user } = requireUser(event);
	const guild = await guildOr404(event.params.id);
	const isStaff = user.capabilities.has('guilds.manage');
	const actor = await actorFor(guild.id, event.locals.character?.id ?? null, isStaff);
	if (!canManageGuild(actor)) error(403, 'Solo i capi della gilda possono farlo.');
	return { user, guild, actor };
}

function readNumber(form: FormData, key: string) {
	const n = Number(form.get(key));
	return Number.isInteger(n) && n > 0 ? n : null;
}

async function maxGuilds(event: RequestEvent) {
	return event.locals.settings.maxGuildsPerCharacter;
}

export const actions: Actions = {
	entra: async (event) => {
		const { user, character } = requireCharacter(event);
		const guild = await guildOr404(event.params.id);
		const message = String((await event.request.formData()).get('message') ?? '').trim();
		try {
			const result = await joinOrApply(guild.id, character.id, await maxGuilds(event), message);
			await audit({
				actorUserId: user.id,
				action: result === 'joined' ? 'guild.join' : 'guild.apply',
				targetType: 'guild',
				targetId: guild.id,
				details: { gilda: guild.name, personaggio: character.name },
				ip: clientIp(event)
			});
			return { success: result === 'joined' ? `Benvenuto in ${guild.name}!` : 'Candidatura inviata: i capi della gilda la valuteranno.' };
		} catch (e) {
			if (e instanceof GuildError) return fail(400, { error: e.message });
			throw e;
		}
	},

	ritira: async (event) => {
		const { character } = requireCharacter(event);
		const guild = await guildOr404(event.params.id);
		await withdrawApplication(guild.id, character.id);
		return { success: 'Candidatura ritirata.' };
	},

	esci: async (event) => {
		const { user, character } = requireCharacter(event);
		const guild = await guildOr404(event.params.id);
		await leave(guild.id, character.id);
		await audit({ actorUserId: user.id, action: 'guild.leave', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: character.name }, ip: clientIp(event) });
		return { success: `Hai lasciato ${guild.name}.` };
	},

	accetta: async (event) => {
		const { user, guild } = await leaderContext(event);
		const id = readNumber(await event.request.formData(), 'id');
		if (!id) return fail(400, { error: 'Candidatura non valida.' });
		try {
			const characterId = await acceptApplication(guild.id, id, await maxGuilds(event));
			await audit({ actorUserId: user.id, action: 'guild.accept', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: characterId }, ip: clientIp(event) });
			return { success: 'Candidatura accettata.' };
		} catch (e) {
			if (e instanceof GuildError) return fail(400, { error: e.message });
			throw e;
		}
	},

	rifiuta: async (event) => {
		const { user, guild } = await leaderContext(event);
		const id = readNumber(await event.request.formData(), 'id');
		if (!id) return fail(400, { error: 'Candidatura non valida.' });
		const characterId = await rejectApplication(guild.id, id);
		await audit({ actorUserId: user.id, action: 'guild.reject', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: characterId }, ip: clientIp(event) });
		return { success: 'Candidatura rifiutata.' };
	},

	aggiungi: async (event) => {
		const { user, guild } = await leaderContext(event);
		const name = String((await event.request.formData()).get('name') ?? '').trim();
		const target = name ? await findCharacterByName(name) : null;
		if (!target) return fail(400, { error: `Nessun personaggio si chiama «${name}».` });
		try {
			await addMemberByCharacter(guild.id, target.id, await maxGuilds(event));
		} catch (e) {
			if (e instanceof GuildError) return fail(400, { error: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'guild.add', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: target.name }, ip: clientIp(event) });
		return { success: `${target.name} è entrato nella gilda.` };
	},

	grado: async (event) => {
		const { user, guild, actor } = await leaderContext(event);
		const form = await event.request.formData();
		const characterId = readNumber(form, 'characterId');
		const rankId = readNumber(form, 'rankId');
		if (!characterId || !rankId) return fail(400, { error: 'Dati non validi.' });
		if (characterId === event.locals.character?.id && !actor.isStaff) return fail(400, { error: 'Non puoi cambiare il tuo grado.' });
		try {
			const rank = await setMemberRank(guild.id, actor, characterId, rankId);
			await audit({ actorUserId: user.id, action: 'guild.rank', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: characterId, grado: rank.name }, ip: clientIp(event) });
			return { success: `Grado aggiornato: ${rank.name}.` };
		} catch (e) {
			if (e instanceof GuildError) return fail(400, { error: e.message });
			throw e;
		}
	},

	espelli: async (event) => {
		const { user, guild, actor } = await leaderContext(event);
		const characterId = readNumber(await event.request.formData(), 'characterId');
		if (!characterId) return fail(400, { error: 'Dati non validi.' });
		if (characterId === event.locals.character?.id) return fail(400, { error: 'Per uscire usa "Lascia la gilda".' });
		try {
			await expel(guild.id, actor, characterId);
		} catch (e) {
			if (e instanceof GuildError) return fail(400, { error: e.message });
			throw e;
		}
		await audit({ actorUserId: user.id, action: 'guild.expel', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, personaggio: characterId }, ip: clientIp(event) });
		return { success: 'Membro espulso.' };
	},

	testi: async (event) => {
		const { user, guild } = await leaderContext(event);
		const form = await event.request.formData();
		const parsed = z
			.object({ description: z.string().trim().max(5000), statute: z.string().trim().max(30000) })
			.safeParse({ description: String(form.get('description') ?? ''), statute: String(form.get('statute') ?? '') });
		if (!parsed.success) return fail(400, { error: 'Testo troppo lungo.' });
		await db.update(schema.guilds).set(parsed.data).where(eq(schema.guilds.id, guild.id));
		await audit({ actorUserId: user.id, action: 'guild.update', targetType: 'guild', targetId: guild.id, details: { gilda: guild.name, campi: 'descrizione e statuto' }, ip: clientIp(event) });
		return { success: 'Descrizione e statuto salvati.' };
	}
};
