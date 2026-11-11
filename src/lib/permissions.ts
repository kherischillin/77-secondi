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
			'audit.view': 'Consultare il registro delle attività'
		}
	},
	{
		label: 'Gioco',
		capabilities: {
			'chat.master': 'Intervenire in chat come Master',
			'chat.npc': 'Intervenire in chat come PNG',
			'characters.manage': 'Modificare i personaggi altrui',
			'world.manage': 'Gestire mappe e luoghi'
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
