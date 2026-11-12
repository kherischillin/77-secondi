/**
 * Pagine aperte anche a chi è entrato ma non ha ancora scelto il personaggio:
 * la scelta stessa, l'account (per crearne uno), le impostazioni, e gli spazi
 * dello staff (un amministratore deve poter gestire il gioco anche senza personaggio).
 */
const WITHOUT_CHARACTER = ['/scegli-personaggio', '/account', '/temi', '/notifiche', '/gestione', '/master', '/pagine', '/esci', '/sospeso'];

export function allowedWithoutCharacter(pathname: string): boolean {
	return pathname === '/' || WITHOUT_CHARACTER.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
