/**
 * Economia del gioco: denaro, oggetti, mercato, stipendi, stanze private.
 * Solo calcoli e validazione, niente database: si possono testare e usare anche nel browser.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Impostazioni (chiave "economy" nella tabella settings)
// ---------------------------------------------------------------------------

export const economySchema = z.object({
	/** Nome della valuta, al plurale (es. "monete", "eurodollari", "crediti"). */
	currencyName: z.string().trim().min(1, 'Dai un nome alla valuta.').max(30),
	/** Denaro in tasca di un personaggio appena creato. */
	startingMoney: z.number().int().min(0).max(1_000_000),
	/** Percentuale del prezzo restituita rivendendo un oggetto al mercato. */
	sellbackPercent: z.number().int().min(0).max(100),
	/** Ogni quante ore si può ritirare lo stipendio di gilda. */
	salaryIntervalHours: z.number().int().min(1).max(24 * 30)
});

export type Economy = z.infer<typeof economySchema>;

export const DEFAULT_ECONOMY: Economy = {
	currencyName: 'monete',
	startingMoney: 100,
	sellbackPercent: 50,
	salaryIntervalHours: 24
};

/** Limite di sicurezza per qualsiasi importo inserito in un modulo. */
export const MAX_AMOUNT = 10_000_000;

export function formatMoney(amount: number, currencyName: string): string {
	return `${amount.toLocaleString('it-IT', { useGrouping: 'always' })} ${currencyName}`;
}

/** Importo positivo inserito in un modulo (deposito, prelievo, bonifico...). */
export const amountSchema = z.coerce
	.number({ error: 'Scrivi un importo.' })
	.int('Solo numeri interi.')
	.min(1, 'L’importo deve essere almeno 1.')
	.max(MAX_AMOUNT, 'Importo troppo alto.');

/** Ricavo della rivendita di un oggetto (arrotondato per difetto). */
export function sellPrice(price: number, sellbackPercent: number): number {
	return Math.floor((price * sellbackPercent) / 100);
}

/** Lo stipendio è pronto? Restituisce anche quando lo sarà. */
export function salaryStatus(lastAt: Date | null, now: Date, intervalHours: number) {
	if (!lastAt) return { ready: true, nextAt: null as Date | null };
	const nextAt = new Date(lastAt.getTime() + intervalHours * 3_600_000);
	return { ready: nextAt <= now, nextAt: nextAt <= now ? null : nextAt };
}

export function roomCost(hourlyPrice: number, hours: number): number {
	return hourlyPrice * hours;
}

// ---------------------------------------------------------------------------
// Oggetti
// ---------------------------------------------------------------------------

export const ITEM_SLOTS = ['none', 'head', 'body', 'hands', 'legs', 'feet', 'weapon', 'accessory', 'implant'] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

export const SLOT_LABELS: Record<ItemSlot, string> = {
	none: 'Non si indossa',
	head: 'Testa',
	body: 'Busto',
	hands: 'Mani',
	legs: 'Gambe',
	feet: 'Piedi',
	weapon: 'Arma',
	accessory: 'Accessorio',
	implant: 'Impianto cibernetico'
};

/** Quanti oggetti si possono indossare insieme in ogni posizione. */
export const SLOT_LIMITS: Record<ItemSlot, number> = {
	none: 0,
	head: 1,
	body: 1,
	hands: 1,
	legs: 1,
	feet: 1,
	weapon: 2,
	accessory: 3,
	implant: 8
};

export function isSlot(v: string): v is ItemSlot {
	return (ITEM_SLOTS as readonly string[]).includes(v);
}

export type ItemBonus = { statId?: number; skillId?: number; value: number };

/** Si può equipaggiare un altro oggetto in questa posizione? */
export function canEquip(slot: string, alreadyEquippedInSlot: number): { ok: true } | { ok: false; reason: string } {
	if (!isSlot(slot) || slot === 'none') return { ok: false, reason: 'Questo oggetto non si indossa.' };
	const limit = SLOT_LIMITS[slot];
	if (alreadyEquippedInSlot >= limit) {
		return {
			ok: false,
			reason:
				limit === 1
					? `Hai già un oggetto in posizione "${SLOT_LABELS[slot]}": toglilo prima.`
					: `Puoi indossare al massimo ${limit} oggetti in posizione "${SLOT_LABELS[slot]}".`
		};
	}
	return { ok: true };
}

/**
 * Bonus degli oggetti equipaggiati per una prova.
 * Per una prova di abilità contano i bonus all'abilità e alla sua caratteristica.
 */
export function equippedBonus(
	equipped: { name: string; bonuses: ItemBonus[] }[],
	target: { statId: number | null; skillId: number | null }
): { value: number; sources: string[] } {
	let value = 0;
	const sources: string[] = [];
	for (const item of equipped) {
		let fromItem = 0;
		for (const b of item.bonuses) {
			if ((target.skillId && b.skillId === target.skillId) || (target.statId && b.statId === target.statId)) {
				fromItem += b.value;
			}
		}
		if (fromItem !== 0) {
			value += fromItem;
			sources.push(`${item.name} ${fromItem > 0 ? '+' : ''}${fromItem}`);
		}
	}
	return { value, sources };
}

const optionalInt = (min: number, max: number) =>
	z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? null : Number(v)),
		z.number().int('Solo numeri interi.').min(min).max(max).nullable()
	);

export const itemFormSchema = z.object({
	name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri.').max(60, 'Nome troppo lungo.'),
	description: z.string().trim().max(3000, 'Descrizione troppo lunga.'),
	category: z.string().trim().max(40, 'Categoria troppo lunga.'),
	slot: z.enum(ITEM_SLOTS),
	price: z.coerce.number().int('Solo numeri interi.').min(0, 'Il prezzo non può essere negativo.').max(MAX_AMOUNT),
	forSale: z.boolean(),
	stock: optionalInt(0, 1_000_000),
	shopId: optionalInt(1, 2_000_000_000),
	sellable: z.boolean(),
	consumable: z.boolean(),
	bonuses: z
		.array(z.object({ statId: z.number().int().positive().optional(), skillId: z.number().int().positive().optional(), value: z.number().int().min(-50).max(50) }))
		.max(6, 'Al massimo 6 bonus per oggetto.')
});

export type ItemForm = z.infer<typeof itemFormSchema>;

/** Legge i bonus dal modulo: coppie bonusTarget (stat:ID / skill:ID) + bonusValue. */
export function readBonuses(targets: string[], values: string[]): ItemBonus[] {
	const out: ItemBonus[] = [];
	targets.forEach((t, i) => {
		const value = Number(values[i]);
		const [type, rawId] = t.split(':');
		const id = Number(rawId);
		if (!t || !Number.isInteger(value) || value === 0 || !Number.isInteger(id) || id <= 0) return;
		if (type === 'stat') out.push({ statId: id, value });
		else if (type === 'skill') out.push({ skillId: id, value });
	});
	return out;
}

export function readItemForm(form: FormData) {
	return itemFormSchema.safeParse({
		name: String(form.get('name') ?? ''),
		description: String(form.get('description') ?? ''),
		category: String(form.get('category') ?? ''),
		slot: String(form.get('slot') ?? 'none'),
		price: form.get('price') || 0,
		forSale: form.get('forSale') === 'on',
		stock: form.get('stock'),
		shopId: form.get('shopId'),
		sellable: form.get('sellable') === 'on',
		consumable: form.get('consumable') === 'on',
		bonuses: readBonuses(form.getAll('bonusTarget').map(String), form.getAll('bonusValue').map(String))
	});
}

/** Gli oggetti da indossare si tengono uno per riga; gli altri si accumulano. */
export function stacks(slot: string): boolean {
	return slot === 'none';
}

export const MONEY_KIND_LABELS: Record<string, string> = {
	start: 'Denaro iniziale',
	deposit: 'Deposito',
	withdraw: 'Prelievo',
	transfer_in: 'Bonifico ricevuto',
	transfer_out: 'Bonifico inviato',
	salary: 'Stipendio',
	purchase: 'Acquisto',
	sale: 'Vendita',
	staff: 'Correzione dello staff',
	room: 'Stanza privata'
};

/** Testo dei bonus di un oggetto, es. "Destrezza +1, Scassinare +2". */
export function describeBonuses(
	bonuses: ItemBonus[],
	stats: { id: number; name: string }[],
	skills: { id: number; name: string }[]
): string {
	return bonuses
		.map((b) => {
			const name = b.statId ? stats.find((s) => s.id === b.statId)?.name : skills.find((s) => s.id === b.skillId)?.name;
			return name ? `${name} ${b.value > 0 ? '+' : '−'}${Math.abs(b.value)}` : null;
		})
		.filter(Boolean)
		.join(', ');
}
