import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { count, eq } from 'drizzle-orm';
import path from 'node:path';
import { db, schema } from './db';
import { ALL_CAPABILITIES, type Capability } from '../permissions';
import { seedBoards } from './boards.ts';
import { seedPages } from './pages.ts';

/** Nome del ruolo con tutti i poteri. È di sistema: non si può cancellare né ridurre. */
export const ADMIN_ROLE_NAME = 'Amministratore';

const DEFAULT_ROLES: {
	name: string;
	description: string;
	capabilities: Capability[];
	isSystem?: boolean;
	isDefault?: boolean;
}[] = [
	{
		name: ADMIN_ROLE_NAME,
		description: 'Controllo completo del sito.',
		capabilities: ALL_CAPABILITIES,
		isSystem: true
	},
	{
		name: 'Moderatore',
		description: 'Gestisce gli account, modera chat e bacheche, consulta il registro.',
		capabilities: ['admin.access', 'users.view', 'users.manage', 'audit.view', 'chat.moderate', 'boards.moderate', 'reports.handle']
	},
	{
		name: 'Master',
		description: 'Narra le giocate, guida le quest e assegna i PX.',
		capabilities: ['chat.master', 'chat.npc', 'xp.award', 'esiti.manage', 'giocate.review', 'items.give']
	},
	{
		name: 'Giocatore',
		description: 'Ruolo base assegnato a ogni nuovo iscritto.',
		capabilities: [],
		isDefault: true
	}
];

/**
 * Prepara il database all'avvio del server:
 * 1. applica le migrazioni mancanti (crea o aggiorna le tabelle);
 * 2. al primissimo avvio crea i ruoli predefiniti.
 */
export async function bootstrapDatabase(): Promise<void> {
	await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });

	const [{ total }] = await db.select({ total: count() }).from(schema.roles);
	if (total === 0) {
		await db.insert(schema.roles).values(DEFAULT_ROLES);
		console.log('Ruoli predefiniti creati.');
	}

	await seedExampleRules();
	await seedExampleItems();
	await seedJobs();
	await seedPrivateRooms();
	await seedBoards();
	await seedPages();

	// L'Amministratore deve sempre avere tutte le capacità, anche quelle aggiunte in versioni future.
	await db
		.update(schema.roles)
		.set({ capabilities: ALL_CAPABILITIES })
		.where(eq(schema.roles.isSystem, true));
}

/**
 * Al primo avvio con le regole crea caratteristiche e abilità di esempio,
 * che lo staff potrà modificare o cancellare dal pannello. Si fa una volta sola.
 */
async function seedExampleRules() {
	const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'rulesSeeded'));
	if (done) return;
	const [{ total }] = await db.select({ total: count() }).from(schema.stats);
	if (total === 0) {
		const created = await db
			.insert(schema.stats)
			.values([
				{ name: 'Forza', description: 'Potenza fisica, sollevare, colpire, resistere alla fatica.', sortOrder: 1 },
				{ name: 'Destrezza', description: 'Agilità, riflessi, mira, mani abili.', sortOrder: 2 },
				{ name: 'Costituzione', description: 'Resistenza, salute, tolleranza a dolore e veleni.', sortOrder: 3 },
				{ name: 'Intelligenza', description: 'Studio, memoria, ragionamento.', sortOrder: 4 },
				{ name: 'Percezione', description: 'Attenzione, sensi, intuito.', sortOrder: 5 },
				{ name: 'Carisma', description: 'Presenza, persuasione, autorità.', sortOrder: 6 }
			])
			.returning();
		const by = (name: string) => created.find((s) => s.name === name)!.id;
		await db.insert(schema.skills).values([
			{ name: 'Armi da mischia', statId: by('Forza'), sortOrder: 1 },
			{ name: 'Atletica', statId: by('Forza'), sortOrder: 2 },
			{ name: 'Armi a distanza', statId: by('Destrezza'), sortOrder: 3 },
			{ name: 'Furtività', statId: by('Destrezza'), sortOrder: 4 },
			{ name: 'Resistenza', statId: by('Costituzione'), sortOrder: 5 },
			{ name: 'Erudizione', statId: by('Intelligenza'), sortOrder: 6 },
			{ name: 'Medicina', statId: by('Intelligenza'), sortOrder: 7 },
			{ name: 'Osservare', statId: by('Percezione'), sortOrder: 8 },
			{ name: 'Persuasione', statId: by('Carisma'), sortOrder: 9 },
			{ name: 'Intimidire', statId: by('Carisma'), sortOrder: 10 }
		]);
		console.log('Regole di esempio create.');
	}
	await db.insert(schema.settings).values({ key: 'rulesSeeded', value: true }).onConflictDoNothing();
}

/**
 * Al primo avvio con l'economia crea qualche oggetto di esempio in vendita al mercato.
 * Lo staff li può modificare, archiviare o cancellare. Si fa una volta sola.
 */
async function seedExampleItems() {
	const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'itemsSeeded'));
	if (done) return;
	const [{ total }] = await db.select({ total: count() }).from(schema.items);
	if (total === 0) {
		const stats = await db.select({ id: schema.stats.id, name: schema.stats.name }).from(schema.stats);
		const skills = await db.select({ id: schema.skills.id, name: schema.skills.name }).from(schema.skills);
		const stat = (name: string, value: number) => {
			const s = stats.find((x) => x.name === name);
			return s ? [{ statId: s.id, value }] : [];
		};
		const skill = (name: string, value: number) => {
			const s = skills.find((x) => x.name === name);
			return s ? [{ skillId: s.id, value }] : [];
		};
		await db.insert(schema.items).values([
			{ name: 'Coltello', category: 'Armi', slot: 'weapon', price: 25, forSale: true, description: 'Lama corta e robusta, buona per tutto.', bonuses: skill('Armi da mischia', 1) },
			{ name: 'Giacca di pelle', category: 'Abiti', slot: 'body', price: 60, forSale: true, description: 'Pelle spessa e consumata, con tasche interne.', bonuses: stat('Costituzione', 1) },
			{ name: 'Guanti leggeri', category: 'Abiti', slot: 'hands', price: 35, forSale: true, description: 'Guanti sottili che non fanno rumore.', bonuses: skill('Furtività', 1) },
			{ name: 'Medikit', category: 'Medicinali', slot: 'none', price: 30, forSale: true, consumable: true, description: 'Bende, disinfettante e il necessario per una medicazione.' },
			{ name: 'Torcia', category: 'Attrezzi', slot: 'none', price: 5, forSale: true, description: 'Fa luce dove serve.' }
		]);
		console.log('Oggetti di esempio creati.');
	}
	await db.insert(schema.settings).values({ key: 'itemsSeeded', value: true }).onConflictDoNothing();
}

/**
 * Al primo avvio crea qualche lavoro libero di esempio (Uffici → Lavori), con paghe provvisorie
 * che lo staff sistemerà in Gestione → Lavori. Si fa una volta sola.
 */
async function seedJobs() {
	const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'jobsSeeded'));
	if (done) return;
	const [{ total }] = await db.select({ total: count() }).from(schema.jobs);
	if (total === 0) {
		await db.insert(schema.jobs).values(
			[
				['Fattorino/a', 'package', 'Consegne a piedi, in moto o con un furgone scassato, da un distretto all’altro. Nessuna domanda sul contenuto dei pacchi.', 40],
				['Barista', 'cocktail', 'Dietro al bancone di un locale: drink sintetici, chiacchiere e orecchie sempre aperte.', 45],
				['Tassista', 'car', 'Guida un taxi o un mezzo abusivo per le strade di Night City, a qualsiasi ora.', 50],
				['Venditore/trice ambulante', 'stall', 'Una bancarella al mercato o un carretto all’angolo: cibo di strada, gadget, ricambi.', 35],
				['Meccanico/a di strada', 'wrench', 'Ripara auto e moto in un’officina di quartiere, spesso senza fare domande.', 60],
				['Tecnico/a elettronico/a', 'chip', 'Aggiusta terminali, telefoni e piccoli impianti in un laboratorio o a domicilio.', 55],
				['Assistente in una clinica', 'medical', 'Aiuta un medico di strada o un installatore di impianti: pulizia, strumenti, pazienti agitati.', 65],
				['Buttafuori', 'shield', 'Tiene l’ordine all’ingresso di un club o di un bar. Decide chi entra e chi no.', 55],
				['Operaio/a al porto', 'anchor', 'Carico e scarico di container, turni lunghi e lavoro pesante sulle banchine.', 50],
				['Addetto/a alle pulizie', 'broom', 'Uffici, appartamenti, scene che è meglio non raccontare. Si vede di tutto.', 35],
				['Rigattiere/a', 'scrap', 'Recupera e rivende rottami, pezzi usati e oggetti trovati tra le macerie.', 30],
				['Musicista di strada', 'music', 'Suona per strada, nei locali o nei vagoni della metro in cambio di qualche spicciolo.', 25]
			].map(([name, icon, description, pay], i) => ({ name: name as string, icon: icon as string, description: description as string, pay: pay as number, sortOrder: i + 1 }))
		);
		console.log('Lavori di esempio creati.');
	}
	await db.insert(schema.settings).values({ key: 'jobsSeeded', value: true }).onConflictDoNothing();
}

/**
 * Al primo avvio crea 10 stanze private (10 all'ora, al massimo 10 ore per prenotazione),
 * raccolte in una mappa senza immagine "Stanze private". Lo staff le può modificare o cancellare
 * da Gestione → Mappe e luoghi. Si fa una volta sola.
 */
async function seedPrivateRooms() {
	const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'privateRoomsSeeded'));
	if (done) return;
	const rooms: [string, string][] = [
		['Suite all’ultimo piano', 'Una suite d’albergo con vista sulle torri. Tappeti spessi, luci soffuse, un minibar fin troppo fornito.'],
		['Capsula-hotel', 'Una capsula per dormire in un alveare di cubicoli. Stretta, ma con la porta che si chiude a chiave.'],
		['Appartamento in affitto', 'Un monolocale affittato a ore: un letto, un tavolo, una finestra che dà sul neon di fronte.'],
		['Retro di un bar', 'La stanza dietro al bancone, tra casse di liquore e un tavolo da poker. La musica arriva attutita.'],
		['Sala karaoke', 'Una saletta insonorizzata con divanetti di finta pelle e uno schermo che nessuno guarda.'],
		['Saletta riservata di un club', 'Un privé sopraelevato dietro un vetro oscurato: si vede la pista, ma nessuno vede dentro.'],
		['Garage abbandonato', 'Un box auto in disuso, odore d’olio e una saracinesca che si abbassa a metà.'],
		['Magazzino al porto', 'Container accatastati e una sola lampada. Lontano da occhi e orecchie indiscrete.'],
		['Ufficio sul tetto', 'Un ufficio vuoto in cima a un palazzo, con l’insegna che lampeggia fuori dalla finestra.'],
		['Rifugio nei Badlands', 'Una baracca nel deserto fuori città. Polvere, silenzio e un generatore che ronza.']
	];
	await db.transaction(async (tx) => {
		const [map] = await tx
			.insert(schema.maps)
			.values({ name: 'Stanze private', description: 'Chat private da prenotare a ore: entrano solo chi le prenota e i suoi invitati.', sortOrder: 100 })
			.returning({ id: schema.maps.id });
		await tx.insert(schema.locations).values(
			rooms.map(([name, description], i) => ({ mapId: map.id, name, description, isPrivate: true, hourlyPrice: 10, maxHours: 10, sortOrder: i + 1 }))
		);
	});
	console.log('Stanze private create.');
	await db.insert(schema.settings).values({ key: 'privateRoomsSeeded', value: true }).onConflictDoNothing();
}
