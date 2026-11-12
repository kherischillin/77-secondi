import { and, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { move, findCharacterByName } from './money.ts';
import { roomCost } from '../economy.ts';
import { fullName } from '../format.ts';

/**
 * Stanze private: luoghi che si prenotano per qualche ora.
 * Durante la prenotazione entrano solo chi l'ha fatta e i suoi invitati (più i moderatori).
 * Ogni prenotazione vede solo i propri messaggi: chi prenota dopo non legge le giocate precedenti.
 */

export class RoomError extends Error {}

type Location = typeof schema.locations.$inferSelect;
type Booking = typeof schema.roomBookings.$inferSelect;

export const MAX_INVITED = 200;

export async function activeBooking(locationId: number, now = new Date()) {
	const [b] = await db
		.select()
		.from(schema.roomBookings)
		.where(and(eq(schema.roomBookings.locationId, locationId), lte(schema.roomBookings.startsAt, now), gt(schema.roomBookings.endsAt, now)))
		.orderBy(desc(schema.roomBookings.id))
		.limit(1);
	return b ?? null;
}

export type RoomAccess = {
	allowed: boolean;
	booking: Booking | null;
	/** Da quando si leggono i messaggi (inizio della prenotazione); null = tutto. */
	since: Date | null;
	isOwner: boolean;
};

export async function roomAccess(location: Location, characterId: number, canModerate: boolean): Promise<RoomAccess> {
	if (!location.isPrivate) return { allowed: true, booking: null, since: null, isOwner: false };
	const booking = await activeBooking(location.id);
	const isOwner = !!booking && booking.ownerCharacterId === characterId;
	const member = !!booking && (isOwner || booking.invitedIds.includes(characterId));
	if (member) return { allowed: true, booking, since: booking.startsAt, isOwner };
	// I moderatori entrano sempre (per le segnalazioni), ma solo nella prenotazione in corso.
	if (canModerate) return { allowed: true, booking, since: booking?.startsAt ?? null, isOwner: false };
	return { allowed: false, booking, since: null, isOwner: false };
}

/** Prenotazione con i nomi del proprietario e degli invitati. */
export async function bookingView(b: Booking) {
	const ids = [b.ownerCharacterId, ...b.invitedIds];
	const rows = await db
		.select({ id: schema.characters.id, name: schema.characters.name, surname: schema.characters.surname })
		.from(schema.characters)
		.where(inArray(schema.characters.id, ids));
	const name = (id: number) => {
		const r = rows.find((x) => x.id === id);
		return r ? fullName(r) : '—';
	};
	return {
		id: b.id,
		owner: { id: b.ownerCharacterId, name: name(b.ownerCharacterId) },
		invited: b.invitedIds.map((id) => ({ id, name: name(id) })),
		startsAt: b.startsAt.toISOString(),
		endsAt: b.endsAt.toISOString()
	};
}

/** Prenota la stanza da adesso per un certo numero di ore, pagando in contanti. */
export async function bookRoom(location: Location, characterId: number, hours: number) {
	if (!location.isPrivate) throw new RoomError('Questo luogo non è una stanza privata.');
	if (!Number.isInteger(hours) || hours < 1 || hours > location.maxHours) {
		throw new RoomError(`Puoi prenotare da 1 a ${location.maxHours} ore.`);
	}
	return db.transaction(async (tx) => {
		// Una prenotazione alla volta per stanza, anche con due richieste simultanee.
		await tx.execute(sql`select pg_advisory_xact_lock(${7_000_000 + location.id})`);
		const now = new Date();
		const [busy] = await tx
			.select({ id: schema.roomBookings.id })
			.from(schema.roomBookings)
			.where(and(eq(schema.roomBookings.locationId, location.id), lte(schema.roomBookings.startsAt, now), gt(schema.roomBookings.endsAt, now)));
		if (busy) throw new RoomError('La stanza è già occupata.');
		const cost = roomCost(location.hourlyPrice, hours);
		if (!(await move(tx, characterId, 'cash', -cost, 'room', { note: `${location.name}, ${hours} ${hours === 1 ? 'ora' : 'ore'}` }))) {
			throw new RoomError('Non hai abbastanza contanti.');
		}
		const [b] = await tx
			.insert(schema.roomBookings)
			.values({ locationId: location.id, ownerCharacterId: characterId, startsAt: now, endsAt: new Date(now.getTime() + hours * 3_600_000) })
			.returning();
		return { booking: b, cost };
	});
}

/** Prolunga la prenotazione (al massimo fino a maxHours da adesso). */
export async function extendBooking(location: Location, booking: Booking, hours: number) {
	const now = Date.now();
	const newEnd = booking.endsAt.getTime() + hours * 3_600_000;
	if (!Number.isInteger(hours) || hours < 1) throw new RoomError('Scegli quante ore aggiungere.');
	if (newEnd - now > location.maxHours * 3_600_000) {
		throw new RoomError(`La stanza si può tenere al massimo ${location.maxHours} ore da adesso.`);
	}
	return db.transaction(async (tx) => {
		const cost = roomCost(location.hourlyPrice, hours);
		if (!(await move(tx, booking.ownerCharacterId, 'cash', -cost, 'room', { note: `${location.name}, +${hours} ${hours === 1 ? 'ora' : 'ore'}` }))) {
			throw new RoomError('Non hai abbastanza contanti.');
		}
		await tx
			.update(schema.roomBookings)
			.set({ endsAt: new Date(newEnd) })
			.where(eq(schema.roomBookings.id, booking.id));
		return cost;
	});
}

export async function invite(booking: Booking, name: string) {
	const c = await findCharacterByName(name);
	if (!c) throw new RoomError(`Nessun personaggio si chiama "${name}".`);
	if (c.id === booking.ownerCharacterId || booking.invitedIds.includes(c.id)) throw new RoomError(`${c.name} può già entrare.`);
	if (booking.invitedIds.length >= MAX_INVITED) throw new RoomError(`Al massimo ${MAX_INVITED} invitati.`);
	await db
		.update(schema.roomBookings)
		.set({ invitedIds: sql`array_append(${schema.roomBookings.invitedIds}, ${c.id})` })
		.where(eq(schema.roomBookings.id, booking.id));
	return c;
}

export async function uninvite(booking: Booking, characterId: number) {
	await db
		.update(schema.roomBookings)
		.set({ invitedIds: sql`array_remove(${schema.roomBookings.invitedIds}, ${characterId})` })
		.where(eq(schema.roomBookings.id, booking.id));
}

/** Libera la stanza prima della scadenza (senza rimborso). */
export async function releaseBooking(booking: Booking) {
	await db.update(schema.roomBookings).set({ endsAt: new Date() }).where(eq(schema.roomBookings.id, booking.id));
}

/** Stato delle stanze private di una mappa (per mostrare "libera / occupata"). */
export async function bookedLocationIds(locationIds: number[]) {
	if (!locationIds.length) return new Set<number>();
	const now = new Date();
	const rows = await db
		.select({ id: schema.roomBookings.locationId })
		.from(schema.roomBookings)
		.where(and(inArray(schema.roomBookings.locationId, locationIds), lte(schema.roomBookings.startsAt, now), gt(schema.roomBookings.endsAt, now)));
	return new Set(rows.map((r) => r.id));
}
