import { hash, verify } from '@node-rs/argon2';

// Parametri Argon2id consigliati da OWASP (19 MiB di memoria, 2 iterazioni).
const OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
	return hash(password, OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
	try {
		return await verify(hashed, password);
	} catch {
		return false;
	}
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
