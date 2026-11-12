import { hash, verify } from '@node-rs/argon2';
import { isLegacyHash, verifyLegacyPassword } from './legacy-password.ts';

// Parametri Argon2id consigliati da OWASP (19 MiB di memoria, 2 iterazioni).
const OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
	return hash(password, OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
	// Account importati da GDRCD: formato phpass o MD5 (vedi legacy-password.ts).
	if (isLegacyHash(hashed)) return verifyLegacyPassword(hashed, password);
	try {
		return await verify(hashed, password);
	} catch {
		return false;
	}
}

/** La password è in un vecchio formato e va riscritta con Argon2 (dopo un accesso riuscito). */
export function needsRehash(hashed: string): boolean {
	return isLegacyHash(hashed);
}

/**
 * Hash fittizio usato quando l'utente non esiste, così il tempo di risposta
 * non rivela se un nome utente è registrato.
 */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
	dummyHash ??= hashPassword('password-fittizia-per-tempi-costanti');
	return dummyHash;
}
