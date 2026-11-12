import { and, asc, eq, gt, inArray, lte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireCharacter } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { getEconomy } from '#lib/server/settings.ts';

/** Uffici → Stanze private: dove sono, quanto costano, se adesso sono libere. Si prenotano dal luogo. */
export const load: PageServerLoad = async (event) => {
	const { character } = requireCharacter(event);
	const rooms = await db
		.select({
			id: schema.locations.id,
			name: schema.locations.name,
			description: schema.locations.description,
			hourlyPrice: schema.locations.hourlyPrice,
			maxHours: schema.locations.maxHours,
			mapName: schema.maps.name
		})
		.from(schema.locations)
		.innerJoin(schema.maps, eq(schema.locations.mapId, schema.maps.id))
		.where(and(eq(schema.locations.isPrivate, true), eq(schema.locations.isActive, true)))
		.orderBy(asc(schema.maps.name), asc(schema.locations.sortOrder), asc(schema.locations.name));

	const now = new Date();
	const bookings = rooms.length
		? await db
				.select({ locationId: schema.roomBookings.locationId, owner: schema.roomBookings.ownerCharacterId, invited: schema.roomBookings.invitedIds, endsAt: schema.roomBookings.endsAt })
				.from(schema.roomBookings)
				.where(and(inArray(schema.roomBookings.locationId, rooms.map((r) => r.id)), lte(schema.roomBookings.startsAt, now), gt(schema.roomBookings.endsAt, now)))
		: [];

	return {
		currency: (await getEconomy()).currencyName,
		rooms: rooms.map((r) => {
			const b = bookings.find((x) => x.locationId === r.id);
			return {
				...r,
				busyUntil: b ? b.endsAt.toISOString() : null,
				mine: !!b && (b.owner === character.id || b.invited.includes(character.id))
			};
		})
	};
};
