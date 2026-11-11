/**
 * Regole della parte social (bacheche, gilde, missive).
 * Logica pura, senza database: usata dal server per decidere e dall'interfaccia per mostrare.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Bacheche
// ---------------------------------------------------------------------------

export type BoardRules = {
	section: 'on' | 'off';
	visibility: 'all' | 'guild' | 'staff';
	guildId: number | null;
	staffOnlyThreads: boolean;
};

export type BoardViewer = {
	/** Ha un personaggio attivo (serve per scrivere nelle bacheche ON GAME). */
	hasCharacter: boolean;
	/** Moderatore delle bacheche (permesso boards.moderate). */
	canModerate: boolean;
	/** Gestore di tutte le gilde (permesso guilds.manage). */
	canManageGuilds: boolean;
	/** Gilde del personaggio attivo. */
	guildIds: ReadonlySet<number>;
	/** Gilde in cui il personaggio attivo ha un grado da capo. */
	leadGuildIds: ReadonlySet<number>;
};

export type BoardAccess = {
	canRead: boolean;
	canStartThread: boolean;
	canReply: boolean;
	/** Chi firma i messaggi: il personaggio (ON GAME) o il giocatore (OFF GAME). */
	postsAs: 'character' | 'player';
	/** Perché non si può scrivere, se non si può. */
	writeBlock: string | null;
};

export function boardAccess(board: BoardRules, viewer: BoardViewer, threadLocked = false): BoardAccess {
	const isGuildBoard = board.visibility === 'guild' && board.guildId !== null;
	const isMember = isGuildBoard && viewer.guildIds.has(board.guildId!);
	const isGuildLeader = isGuildBoard && viewer.leadGuildIds.has(board.guildId!);

	const canRead =
		board.visibility === 'all' ||
		viewer.canModerate ||
		(board.visibility === 'guild' && (isMember || viewer.canManageGuilds));

	const postsAs = board.section === 'on' ? 'character' : 'player';
	let writeBlock: string | null = null;
	if (!canRead) writeBlock = 'Non puoi accedere a questa bacheca.';
	else if (postsAs === 'character' && !viewer.hasCharacter) {
		writeBlock = 'Nelle bacheche ON GAME si scrive come personaggio: scegli prima con chi giocare.';
	} else if (board.visibility === 'guild' && !isMember && !viewer.canModerate) {
		writeBlock = 'Solo i membri della gilda possono scrivere qui.';
	}

	const staffLike = viewer.canModerate || isGuildLeader;
	const canWrite = writeBlock === null;
	const canStartThread = canWrite && (!board.staffOnlyThreads || staffLike);
	const canReply = canWrite && (!threadLocked || viewer.canModerate);

	return {
		canRead,
		canStartThread,
		canReply,
		postsAs,
		writeBlock:
			writeBlock ??
			(threadLocked && !viewer.canModerate ? 'La discussione è chiusa.' : null)
	};
}

export const threadSchema = z.object({
	title: z.string().trim().min(3, 'Il titolo deve avere almeno 3 caratteri.').max(120, 'Titolo troppo lungo.'),
	body: z.string().trim().min(1, 'Scrivi il messaggio.').max(20000, 'Il messaggio è troppo lungo (massimo 20000 caratteri).')
});

export const postSchema = threadSchema.pick({ body: true });

// ---------------------------------------------------------------------------
// Gilde
// ---------------------------------------------------------------------------

export type GuildActor = {
	/** Staff con il permesso guilds.manage: può tutto. */
	isStaff: boolean;
	/** Grado del personaggio nella gilda, se ne fa parte. */
	rank: { level: number; canManage: boolean } | null;
};

/** Può gestire la gilda (candidature, descrizione)? */
export function canManageGuild(actor: GuildActor): boolean {
	return actor.isStaff || !!actor.rank?.canManage;
}

/** Può agire su un membro (cambiargli grado, espellerlo)? Solo su chi sta sotto di lui. */
export function canActOnMember(actor: GuildActor, targetLevel: number): boolean {
	if (actor.isStaff) return true;
	return !!actor.rank?.canManage && targetLevel < actor.rank.level;
}

/** Può assegnare questo grado? Solo gradi inferiori al proprio. */
export function canAssignRank(actor: GuildActor, rankLevel: number): boolean {
	if (actor.isStaff) return true;
	return !!actor.rank?.canManage && rankLevel < actor.rank.level;
}

/** Dati della gilda modificabili dallo staff. */
export const guildFormSchema = z.object({
	name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(60, 'Nome troppo lungo.'),
	category: z.string().trim().max(40, 'Tipo troppo lungo.'),
	description: z.string().trim().max(5000, 'Descrizione troppo lunga.'),
	joinMode: z.enum(['open', 'apply', 'closed'])
});

export const JOIN_MODE_LABELS = {
	open: 'Ingresso libero',
	apply: 'Su candidatura',
	closed: 'Solo su invito dei capi'
} as const;

// ---------------------------------------------------------------------------
// Missive
// ---------------------------------------------------------------------------

export const newMessageSchema = z.object({
	to: z.string().trim().min(1, 'Indica il destinatario.').max(80),
	subject: z.string().trim().min(1, 'Scrivi un oggetto.').max(120, 'Oggetto troppo lungo.'),
	body: z.string().trim().min(1, 'Scrivi il messaggio.').max(10000, 'Il messaggio è troppo lungo (massimo 10000 caratteri).'),
	onGame: z.boolean()
});

export const replySchema = newMessageSchema.pick({ body: true });
