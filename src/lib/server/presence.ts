import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { avatarResolver } from './avatars.ts';

/** Un personaggio è considerato presente se si è fatto vivo negli ultimi 2 minuti. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export type PresentCharacter = {
	characterId: number;
	name: string;
	surname: string | null;
	/** Avatar quadrato già pronto da mostrare (null = iniziale del nome). */
	avatarUrl: string | null;
	lastPostAt: string | null;
};

export type OnlineCharacter = PresentCharacter & {
	mapName: string | null;
	locationId: number | null;
	locationName: string | null;
	/** Il luogo è una stanza privata: chi c'è dentro non si mostra a tutti. */
	locationPrivate: boolean;
};

function onlineSince() {
	return new Date(Date.now() - ONLINE_WINDOW_MS);
}

async function upsert(characterId: number, values: Partial<typeof schema.characterPresence.$inferInsert>) {
	await db
		.insert(schema.characterPresence)
		.values({ characterId, lastSeenAt: new Date(), ...values })
		.onConflictDoUpdate({
			target: schema.characterPresence.characterId,
			set: { lastSeenAt: new Date(), ...values }
		});
}

export async function getPresence(characterId: number) {
	const [p] = await db
		.select()
		.from(schema.characterPresence)
		.where(eq(schema.characterPresence.characterId, characterId));
	return p ?? null;
}

export function enterMap(characterId: number, mapId: number) {
	return upsert(characterId, { mapId, locationId: null });
}

export function enterLocation(characterId: number, mapId: number, locationId: number) {
	return upsert(characterId, { mapId, locationId });
}

export async function touch(characterId: number) {
	await db
		.update(schema.characterPresence)
		.set({ lastSeenAt: new Date() })
		.where(eq(schema.characterPresence.characterId, characterId));
}

/** Toglie il personaggio dal luogo, solo se si trova ancora lì. */
export async function leaveLocation(characterId: number, locationId: number) {
	await db
		.update(schema.characterPresence)
		.set({ locationId: null })
		.where(
			and(
				eq(schema.characterPresence.characterId, characterId),
				eq(schema.characterPresence.locationId, locationId)
			)
		);
}

export async function markPosted(characterId: number) {
	await db
		.update(schema.characterPresence)
		.set({ lastPostAt: new Date(), lastSeenAt: new Date() })
		.where(eq(schema.characterPresence.characterId, characterId));
}

/** Personaggi presenti in un luogo, dal più "in attesa" (che non scrive da più tempo). */
export async function listPresentAt(locationId: number): Promise<PresentCharacter[]> {
	const rows = await db
		.select({
			characterId: schema.characters.id,
			name: schema.characters.name,
			surname: schema.characters.surname,
			avatar: schema.characters.avatar,
			lastPostAt: schema.characterPresence.lastPostAt
		})
		.from(schema.characterPresence)
		.innerJoin(schema.characters, eq(schema.characterPresence.characterId, schema.characters.id))
		.where(
			and(
				eq(schema.characterPresence.locationId, locationId),
				gt(schema.characterPresence.lastSeenAt, onlineSince()),
				isNull(schema.characters.deletedAt)
			)
		)
		.orderBy(asc(schema.characters.name));
	const src = await avatarResolver();
	return rows.map(({ avatar, ...r }) => ({ ...r, avatarUrl: src(avatar), lastPostAt: r.lastPostAt?.toISOString() ?? null }));
}

/** Tutti i personaggi in gioco in questo momento, con il luogo in cui si trovano. */
export async function listOnline(): Promise<OnlineCharacter[]> {
	const rows = await db
		.select({
			characterId: schema.characters.id,
			name: schema.characters.name,
			surname: schema.characters.surname,
			avatar: schema.characters.avatar,
			lastPostAt: schema.characterPresence.lastPostAt,
			mapName: schema.maps.name,
			locationId: schema.locations.id,
			locationName: schema.locations.name,
			locationPrivate: schema.locations.isPrivate
		})
		.from(schema.characterPresence)
		.innerJoin(schema.characters, eq(schema.characterPresence.characterId, schema.characters.id))
		.leftJoin(schema.maps, eq(schema.characterPresence.mapId, schema.maps.id))
		.leftJoin(schema.locations, eq(schema.characterPresence.locationId, schema.locations.id))
		.where(and(gt(schema.characterPresence.lastSeenAt, onlineSince()), isNull(schema.characters.deletedAt)))
		.orderBy(asc(schema.characters.name));
	const src = await avatarResolver();
	return rows.map(({ avatar, ...r }) => ({
		...r,
		avatarUrl: src(avatar),
		locationPrivate: r.locationPrivate ?? false,
		lastPostAt: r.lastPostAt?.toISOString() ?? null
	}));
}

/** Quanti personaggi ci sono in ogni luogo (per i numeri sulla mappa). */
export async function countByLocation(): Promise<Map<number, number>> {
	const online = await listOnline();
	const counts = new Map<number, number>();
	for (const c of online) {
		if (c.locationId) counts.set(c.locationId, (counts.get(c.locationId) ?? 0) + 1);
	}
	return counts;
}
