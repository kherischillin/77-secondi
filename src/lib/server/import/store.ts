import { randomBytes } from 'node:crypto';
import type { Tables } from './sql-dump.ts';
import type { ImportOptions } from './gdrcd.ts';

/**
 * Dump analizzati in attesa di conferma: restano in memoria per 30 minuti,
 * così per importare non serve ricaricare il file.
 */
type Pending = { tables: Tables; options: ImportOptions; userId: number; fileName: string; expires: number };
const pending = new Map<string, Pending>();
const TTL = 30 * 60 * 1000;

export function storePending(p: Omit<Pending, 'expires'>): string {
	for (const [k, v] of pending) if (v.expires < Date.now() || v.userId === p.userId) pending.delete(k);
	const token = randomBytes(16).toString('hex');
	pending.set(token, { ...p, expires: Date.now() + TTL });
	return token;
}

export function takePending(token: string, userId: number): Pending | null {
	const p = pending.get(token);
	if (!p || p.userId !== userId || p.expires < Date.now()) return null;
	pending.delete(token);
	return p;
}
