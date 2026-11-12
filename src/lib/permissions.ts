/**
 * Catalogo delle capacità.
 *
 * Una capacità è un singolo permesso ("può gestire i ruoli", "può scrivere come Master").
 * I ruoli raccolgono capacità e si configurano dal pannello di gestione.
 * Per aggiungere un permesso nuovo basta aggiungerlo qui: comparirà da solo nel pannello.
 */
export const CAPABILITY_GROUPS = [
	{
		label: 'Gestione',
		capabilities: {
			'admin.access': 'Accedere al pannello di gestione',
			'users.view': 'Vedere l’elenco degli account',
			'users.manage': 'Assegnare ruoli e sospendere account',
			'roles.manage': 'Creare e modificare i ruoli',
			'settings.manage': 'Modificare le impostazioni del sito',
			'rules.manage': 'Modificare le regole di gioco (caratteristiche, abilità, costi)',
			'audit.view': 'Consultare il registro delle attività',
			'boards.manage': 'Creare e modificare le bacheche',
			'boards.moderate': 'Moderare le bacheche (nascondere, bloccare, fissare) e leggere quelle dello staff',
			'guilds.manage': 'Creare le gilde e gestirle tutte',
			'reports.handle': 'Gestire le segnalazioni dei giocatori',
			'economy.manage': 'Gestire l’economia (valuta, stipendi, correzioni del denaro)',
			'items.manage': 'Gestire il catalogo degli oggetti e il mercato',
			'pages.manage': 'Scrivere le pagine informative (guida, regolamento, ambientazione)',
			'import.run': 'Importare i dati da un vecchio gioco GDRCD'
		}
	},
	{
		label: 'Gioco',
		capabilities: {
			'chat.master': 'Intervenire in chat come Master',
			'chat.npc': 'Intervenire in chat come PNG',
			'chat.moderate': 'Nascondere messaggi in chat (moderazione)',
			'characters.manage': 'Modificare le schede e i valori dei personaggi altrui',
			'xp.award': 'Assegnare punti esperienza',
			'esiti.manage': 'Rispondere alle richieste di esito',
			'giocate.review': 'Rivedere le giocate registrate e leggerle tutte',
			'items.give': 'Consegnare oggetti ai personaggi (es. premi di quest)',
			'world.manage': 'Gestire mappe, luoghi, stanze private e meteo'
		}
	}
] as const;

type Group = (typeof CAPABILITY_GROUPS)[number];
type KeysOf<G> = G extends { capabilities: infer C } ? keyof C : never;
export type Capability = KeysOf<Group> & string;

export const ALL_CAPABILITIES: Capability[] = CAPABILITY_GROUPS.flatMap(
	(g) => Object.keys(g.capabilities) as Capability[]
);

export function isCapability(value: string): value is Capability {
	return (ALL_CAPABILITIES as string[]).includes(value);
}

/** Tiene solo le capacità valide, senza duplicati, nell'ordine del catalogo. */
export function normalizeCapabilities(values: Iterable<string>): Capability[] {
	const wanted = new Set(values);
	return ALL_CAPABILITIES.filter((c) => wanted.has(c));
}

export function hasCapability(
	capabilities: ReadonlySet<string> | readonly string[] | undefined | null,
	capability: Capability
): boolean {
	if (!capabilities) return false;
	return 'has' in capabilities
		? capabilities.has(capability)
		: (capabilities as readonly string[]).includes(capability);
}
