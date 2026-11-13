/**
 * Icone di "ruolo" accanto al nome di un personaggio (presenti, scheda): il lavoro libero
 * oppure le gilde. Quelle delle gilde portano alla pagina della gilda.
 */
export type RoleBadge = { icon: string; title: string; href: string | null };

export function roleBadges(
	job: { name: string | null; icon: string | null } | null,
	guilds: { id: number; name: string; icon: string; rank: string }[] = []
): RoleBadge[] {
	const out: RoleBadge[] = guilds.map((g) => ({ icon: g.icon, title: `${g.rank} · ${g.name}`, href: `/gilde/${g.id}` }));
	// Chi è in una gilda non ha lavoro libero; se per qualche motivo li avesse entrambi, la gilda viene prima.
	if (job?.name && job.icon) out.push({ icon: job.icon, title: job.name, href: null });
	return out;
}
