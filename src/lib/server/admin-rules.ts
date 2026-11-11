/**
 * Regole anti-abuso del pannello di gestione.
 *
 * Principio: nessuno può concedere o toccare poteri che non ha.
 * - Si possono assegnare solo ruoli le cui capacità si possiedono già tutte.
 * - Non si può agire (ruoli, sospensioni) su un account che ha capacità che non si possiedono:
 *   un Moderatore non può sospendere un Amministratore.
 */

export function isSubset(subset: Iterable<string>, superset: ReadonlySet<string>): boolean {
	for (const c of subset) if (!superset.has(c)) return false;
	return true;
}

export function canAssignRole(
	actorCapabilities: ReadonlySet<string>,
	role: { capabilities: readonly string[] }
): boolean {
	return isSubset(role.capabilities, actorCapabilities);
}

export function canActOnUser(
	actor: { id: number; capabilities: ReadonlySet<string> },
	target: { id: number; capabilities: Iterable<string> }
): boolean {
	if (actor.id === target.id) return false;
	return isSubset(target.capabilities, actor.capabilities);
}
