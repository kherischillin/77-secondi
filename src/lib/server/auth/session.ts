import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db, schema } from '../db';
import { env } from '../env';

export const SESSION_COOKIE = 'gdr_session';
const DAY = 24 * 60 * 60 * 1000;
const SESSION_LENGTH = 30 * DAY;
const RENEW_THRESHOLD = 15 * DAY;

export type SessionUser = {
	id: number;
	username: string;
	email: string;
	bannedUntil: Date | null;
	banReason: string | null;
	theme: string | null;
	notify: unknown;
	roles: string[];
	capabilities: Set<string>;
};

export type ActiveCharacter = { id: number; name: string; surname: string | null };

export type ValidatedSession = {
	session: { id: string; expiresAt: Date; activeCharacterId: number | null };
	user: SessionUser;
	character: ActiveCharacter | null;
};

/** Token casuale da 160 bit: va nel cookie del browser. */
export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	return encodeBase32LowerCaseNoPadding(bytes);
}

/** Nel database si salva solo l'hash del token: un furto del DB non permette di impersonare nessuno. */
export function hashToken(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export async function createSession(
	token: string,
	userId: number,
	meta: { ip?: string | null; userAgent?: string | null } = {}
) {
	const session = {
		id: hashToken(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_LENGTH),
		ip: meta.ip ?? null,
		userAgent: meta.userAgent?.slice(0, 300) ?? null
	};
	await db.insert(schema.sessions).values(session);
	return session;
}

export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
	const sessionId = hashToken(token);
	const [row] = await db
		.select({ session: schema.sessions, user: schema.users })
		.from(schema.sessions)
		.innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
		.where(eq(schema.sessions.id, sessionId));

	if (!row) return null;

	const { session, user } = row;
	if (Date.now() >= session.expiresAt.getTime()) {
		await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
		return null;
	}

	// Rinnovo "scorrevole": chi gioca spesso non viene mai disconnesso.
	if (Date.now() >= session.expiresAt.getTime() - RENEW_THRESHOLD) {
		session.expiresAt = new Date(Date.now() + SESSION_LENGTH);
		await db
			.update(schema.sessions)
			.set({ expiresAt: session.expiresAt })
			.where(eq(schema.sessions.id, sessionId));
	}

	const roleRows = await db
		.select({ name: schema.roles.name, capabilities: schema.roles.capabilities })
		.from(schema.userRoles)
		.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
		.where(eq(schema.userRoles.userId, user.id));

	let character: ActiveCharacter | null = null;
	if (session.activeCharacterId) {
		const [c] = await db
			.select({
				id: schema.characters.id,
				name: schema.characters.name,
				surname: schema.characters.surname
			})
			.from(schema.characters)
			.where(
				and(
					eq(schema.characters.id, session.activeCharacterId),
					eq(schema.characters.userId, user.id),
					isNull(schema.characters.deletedAt)
				)
			);
		character = c ?? null;
	}

	return {
		session: {
			id: session.id,
			expiresAt: session.expiresAt,
			activeCharacterId: character?.id ?? null
		},
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			bannedUntil: user.bannedUntil,
			banReason: user.banReason,
			theme: user.theme,
			notify: user.notify,
			roles: roleRows.map((r) => r.name),
			capabilities: new Set(roleRows.flatMap((r) => r.capabilities))
		},
		character
	};
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function invalidateUserSessions(userId: number): Promise<void> {
	await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export async function setActiveCharacter(sessionId: string, characterId: number | null) {
	await db
		.update(schema.sessions)
		.set({ activeCharacterId: characterId })
		.where(eq(schema.sessions.id, sessionId));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: env.isProduction,
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Pulizia periodica delle sessioni scadute. */
export async function deleteExpiredSessions(): Promise<void> {
	await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}

