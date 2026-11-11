/** Accetta solo percorsi interni per i redirect "dopo l'accesso" (evita redirect verso siti esterni). */
export function safeRedirectTarget(value: string | null | undefined, fallback = '/account'): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return fallback;
	}
	return value;
}
