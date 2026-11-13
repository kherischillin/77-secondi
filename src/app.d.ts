import type { ActiveCharacter, SessionUser } from '#lib/server/auth/session.ts';
import type { SiteSettings } from '#lib/server/settings.ts';
import type { ThemeId } from '#lib/themes.ts';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			session: { id: string; expiresAt: Date; activeCharacterId: number | null } | null;
			character: ActiveCharacter | null;
			settings: SiteSettings;
			/** Tema grafico della richiesta (del giocatore o del sito). */
			theme: ThemeId;
		}
	}
}

export {};
