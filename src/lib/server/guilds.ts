import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { mediaUrl } from './uploads.ts';
import { canActOnMember, canAssignRank, type GuildActor } from '../social.ts';
import { fullName } from '../format.ts';

export class GuildError extends Error {}

export type GuildSummary = {
	id: number;
	name: string;
	category: string;
	description: string;
	symbolUrl: string | null;
	icon: string;
	joinMode: 'open' | 'apply' | 'closed';
	isActive: boolean;
	members: number;
};

export async function listGuilds(includeInactive = false): Promise<GuildSummary[]> {
	const rows = await db
		.select({
			guild: schema.guilds,
			members: sql<number>`(select count(*)::int from ${schema.guildMembers} gm where gm.guild_id = ${schema.guilds.id})`
		})
		.from(schema.guilds)
		.where(includeInactive ? undefined : eq(schema.guilds.isActive, true))
		.orderBy(asc(schema.guilds.name));
	return rows.map(({ guild: g, members }) => ({
		id: g.id,
		name: g.name,
		category: g.category,
		description: g.description,
		symbolUrl: mediaUrl(g.symbol),
		icon: g.icon,
		joinMode: g.joinMode,
		isActive: g.isActive,
		members
	}));
}

export async function getGuild(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [g] = await db.select().from(schema.guilds).where(eq(schema.guilds.id, id));
	return g ?? null;
}

export async function listRanks(guildId: number) {
	return db.select().from(schema.guildRanks).where(eq(schema.guildRanks.guildId, guildId)).orderBy(desc(schema.guildRanks.level));
}

export async function listMembers(guildId: number) {
	const rows = await db
		.select({
			characterId: schema.characters.id,
			name: schema.characters.name,
			surname: schema.characters.surname,
			avatar: schema.characters.avatar,
			rankId: schema.guildRanks.id,
			rankName: schema.guildRanks.name,
			level: schema.guildRanks.level,
			canManage: schema.guildRanks.canManage,
			joinedAt: schema.guildMembers.joinedAt
		})
		.from(schema.guildMembers)
		.innerJoin(schema.characters, eq(schema.guildMembers.characterId, schema.characters.id))
		.innerJoin(schema.guildRanks, eq(schema.guildMembers.rankId, schema.guildRanks.id))
		.where(and(eq(schema.guildMembers.guildId, guildId), sql`${schema.characters.deletedAt} is null`))
		.orderBy(desc(schema.guildRanks.level), asc(schema.characters.name));
	return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

export async function listApplications(guildId: number) {
	const rows = await db
		.select({
			id: schema.guildApplications.id,
			characterId: schema.characters.id,
			name: schema.characters.name,
			surname: schema.characters.surname,
			message: schema.guildApplications.message,
			createdAt: schema.guildApplications.createdAt
		})
		.from(schema.guildApplications)
		.innerJoin(schema.characters, eq(schema.guildApplications.characterId, schema.characters.id))
		.where(eq(schema.guildApplications.guildId, guildId))
		.orderBy(asc(schema.guildApplications.createdAt));
	return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Gilde di un personaggio, con il suo grado. */
export async function membershipsOf(characterId: number) {
	const rows = await db
		.select({
			guildId: schema.guilds.id,
			guildName: schema.guilds.name,
			symbol: schema.guilds.symbol,
			icon: schema.guilds.icon,
			rankName: schema.guildRanks.name,
			level: schema.guildRanks.level,
			canManage: schema.guildRanks.canManage
		})
		.from(schema.guildMembers)
		.innerJoin(schema.guilds, eq(schema.guildMembers.guildId, schema.guilds.id))
		.innerJoin(schema.guildRanks, eq(schema.guildMembers.rankId, schema.guildRanks.id))
		.where(and(eq(schema.guildMembers.characterId, characterId), eq(schema.guilds.isActive, true)))
		.orderBy(asc(schema.guilds.name));
	return rows.map(({ symbol, ...r }) => ({ ...r, symbolUrl: mediaUrl(symbol) }));
}

export async function actorFor(guildId: number, characterId: number | null, isStaff: boolean): Promise<GuildActor> {
	if (!characterId) return { isStaff, rank: null };
	const [row] = await db
		.select({ level: schema.guildRanks.level, canManage: schema.guildRanks.canManage })
		.from(schema.guildMembers)
		.innerJoin(schema.guildRanks, eq(schema.guildMembers.rankId, schema.guildRanks.id))
		.where(and(eq(schema.guildMembers.guildId, guildId), eq(schema.guildMembers.characterId, characterId)));
	return { isStaff, rank: row ?? null };
}

export type RankSeed = { name: string; level: number; canManage?: boolean; salary?: number };

const DEFAULT_RANKS: RankSeed[] = [
	{ name: 'Capo', level: 100, canManage: true },
	{ name: 'Ufficiale', level: 50, canManage: true },
	{ name: 'Membro', level: 10 },
	{ name: 'Recluta', level: 1 }
];

/** Crea una gilda con i suoi gradi (predefiniti se non indicati) e la sua bacheca riservata. */
export async function createGuild(
	input: { name: string; category: string; description: string; joinMode: 'open' | 'apply' | 'closed'; symbol: string | null; icon?: string; statute?: string },
	ranks: RankSeed[] = DEFAULT_RANKS
) {
	return db.transaction(async (tx) => {
		const [exists] = await tx
			.select({ id: schema.guilds.id })
			.from(schema.guilds)
			.where(sql`lower(${schema.guilds.name}) = lower(${input.name})`);
		if (exists) throw new GuildError('Esiste già una gilda con questo nome.');

		const [guild] = await tx.insert(schema.guilds).values(input).returning();
		await tx.insert(schema.guildRanks).values(
			ranks.map((r) => ({ guildId: guild.id, name: r.name, level: r.level, canManage: r.canManage ?? false, salary: r.salary ?? 0 }))
		);
		await tx.insert(schema.boards).values({
			name: `Bacheca: ${guild.name}`,
			description: `Bacheca riservata ai membri di ${guild.name}.`,
			section: 'on',
			visibility: 'guild',
			guildId: guild.id,
			sortOrder: 100
		});
		return guild;
	});
}

async function lowestRank(guildId: number) {
	const [rank] = await db
		.select()
		.from(schema.guildRanks)
		.where(eq(schema.guildRanks.guildId, guildId))
		.orderBy(asc(schema.guildRanks.level))
		.limit(1);
	if (!rank) throw new GuildError('La gilda non ha ancora nessun grado.');
	return rank;
}

async function ensureCanJoin(guildId: number, characterId: number, maxGuilds: number) {
	const [already] = await db
		.select()
		.from(schema.guildMembers)
		.where(and(eq(schema.guildMembers.guildId, guildId), eq(schema.guildMembers.characterId, characterId)));
	if (already) throw new GuildError('Fai già parte di questa gilda.');
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(schema.guildMembers)
		.where(eq(schema.guildMembers.characterId, characterId));
	if (n >= maxGuilds) throw new GuildError(`Puoi far parte al massimo di ${maxGuilds} gild${maxGuilds === 1 ? 'a' : 'e'}.`);
}

/**
 * Entrata in gilda. Chi viene preso in una gilda lascia in automatico il lavoro libero:
 * da quel momento l'occupazione (e la paga) è quella della gilda.
 */
async function addMemberRow(guildId: number, characterId: number) {
	const rank = await lowestRank(guildId);
	await db.transaction(async (tx) => {
		await tx.insert(schema.guildMembers).values({ guildId, characterId, rankId: rank.id });
		await tx
			.delete(schema.guildApplications)
			.where(and(eq(schema.guildApplications.guildId, guildId), eq(schema.guildApplications.characterId, characterId)));
		await tx.update(schema.characters).set({ jobId: null }).where(eq(schema.characters.id, characterId));
	});
}

/** Gilde (attive) di più personaggi in una volta, per le icone di presenti e schede. */
export async function guildBadgesOf(characterIds: number[]) {
	const out = new Map<number, { id: number; name: string; icon: string; rank: string }[]>();
	if (!characterIds.length) return out;
	const rows = await db
		.select({
			characterId: schema.guildMembers.characterId,
			id: schema.guilds.id,
			name: schema.guilds.name,
			icon: schema.guilds.icon,
			rank: schema.guildRanks.name
		})
		.from(schema.guildMembers)
		.innerJoin(schema.guilds, eq(schema.guildMembers.guildId, schema.guilds.id))
		.innerJoin(schema.guildRanks, eq(schema.guildMembers.rankId, schema.guildRanks.id))
		.where(and(inArray(schema.guildMembers.characterId, characterIds), eq(schema.guilds.isActive, true)))
		.orderBy(asc(schema.guilds.name));
	for (const { characterId, ...g } of rows) out.set(characterId, [...(out.get(characterId) ?? []), g]);
	return out;
}

/** Ingresso: diretto se la gilda è aperta, candidatura se è su candidatura. */
export async function joinOrApply(guildId: number, characterId: number, maxGuilds: number, message: string) {
	const guild = await getGuild(guildId);
	if (!guild || !guild.isActive) throw new GuildError('Gilda non trovata.');
	await ensureCanJoin(guildId, characterId, maxGuilds);
	if (guild.joinMode === 'closed') throw new GuildError('In questa gilda si entra solo su invito dei capi.');
	if (guild.joinMode === 'open') {
		await addMemberRow(guildId, characterId);
		return 'joined' as const;
	}
	await db
		.insert(schema.guildApplications)
		.values({ guildId, characterId, message: message.slice(0, 1000) })
		.onConflictDoUpdate({
			target: [schema.guildApplications.guildId, schema.guildApplications.characterId],
			set: { message: message.slice(0, 1000), createdAt: new Date() }
		});
	return 'applied' as const;
}

export async function withdrawApplication(guildId: number, characterId: number) {
	await db
		.delete(schema.guildApplications)
		.where(and(eq(schema.guildApplications.guildId, guildId), eq(schema.guildApplications.characterId, characterId)));
}

export async function leave(guildId: number, characterId: number) {
	await db
		.delete(schema.guildMembers)
		.where(and(eq(schema.guildMembers.guildId, guildId), eq(schema.guildMembers.characterId, characterId)));
}

export async function acceptApplication(guildId: number, applicationId: number, maxGuilds: number) {
	const [app] = await db
		.select()
		.from(schema.guildApplications)
		.where(and(eq(schema.guildApplications.id, applicationId), eq(schema.guildApplications.guildId, guildId)));
	if (!app) throw new GuildError('Candidatura non trovata.');
	await ensureCanJoin(guildId, app.characterId, maxGuilds);
	await addMemberRow(guildId, app.characterId);
	return app.characterId;
}

export async function rejectApplication(guildId: number, applicationId: number) {
	const [app] = await db
		.delete(schema.guildApplications)
		.where(and(eq(schema.guildApplications.id, applicationId), eq(schema.guildApplications.guildId, guildId)))
		.returning();
	return app?.characterId ?? null;
}

/** I capi aggiungono direttamente un personaggio (gilde chiuse, reclutamenti avvenuti in gioco). */
export async function addMemberByCharacter(guildId: number, characterId: number, maxGuilds: number) {
	await ensureCanJoin(guildId, characterId, maxGuilds);
	await addMemberRow(guildId, characterId);
}

async function memberLevel(guildId: number, characterId: number) {
	const [row] = await db
		.select({ level: schema.guildRanks.level })
		.from(schema.guildMembers)
		.innerJoin(schema.guildRanks, eq(schema.guildMembers.rankId, schema.guildRanks.id))
		.where(and(eq(schema.guildMembers.guildId, guildId), eq(schema.guildMembers.characterId, characterId)));
	return row?.level ?? null;
}

/** Cambia il grado di un membro, rispettando la gerarchia. */
export async function setMemberRank(guildId: number, actor: GuildActor, characterId: number, rankId: number) {
	const level = await memberLevel(guildId, characterId);
	if (level === null) throw new GuildError('Questo personaggio non fa parte della gilda.');
	if (!canActOnMember(actor, level)) throw new GuildError('Puoi cambiare il grado solo di chi sta sotto di te.');
	const [rank] = await db
		.select()
		.from(schema.guildRanks)
		.where(and(eq(schema.guildRanks.id, rankId), eq(schema.guildRanks.guildId, guildId)));
	if (!rank) throw new GuildError('Grado non valido.');
	if (!canAssignRank(actor, rank.level)) throw new GuildError('Non puoi assegnare un grado pari o superiore al tuo.');
	await db
		.update(schema.guildMembers)
		.set({ rankId: rank.id })
		.where(and(eq(schema.guildMembers.guildId, guildId), eq(schema.guildMembers.characterId, characterId)));
	return rank;
}

export async function expel(guildId: number, actor: GuildActor, characterId: number) {
	const level = await memberLevel(guildId, characterId);
	if (level === null) throw new GuildError('Questo personaggio non fa parte della gilda.');
	if (!canActOnMember(actor, level)) throw new GuildError('Puoi espellere solo chi sta sotto di te.');
	await leave(guildId, characterId);
}

export function memberName(m: { name: string; surname: string | null }) {
	return fullName(m);
}
