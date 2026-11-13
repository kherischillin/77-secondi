/**
 * Schema del database.
 *
 * Scelte di fondo (diverse da GDRCD):
 * - l'account (users) è separato dai personaggi (characters): un utente può avere più PG;
 * - tutte le chiavi sono numeriche, i nomi sono semplici campi modificabili;
 * - le relazioni hanno vincoli veri (foreign key) e cancellazioni coerenti;
 * - i permessi sono "capacità" raccolte in ruoli configurabili, non livelli numerici.
 */
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	uniqueIndex,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Account di gioco: chi si collega. */
export const users = pgTable(
	'users',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		username: text('username').notNull(),
		email: text('email').notNull(),
		passwordHash: text('password_hash').notNull(),
		createdAt: createdAt(),
		lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
		/** Se valorizzato e nel futuro, l'account è sospeso fino a quella data. */
		bannedUntil: timestamp('banned_until', { withTimezone: true }),
		banReason: text('ban_reason'),
		/** Tema grafico scelto dal giocatore (null = quello del sito). */
		theme: text('theme'),
		/** Preferenze di notifica (src/lib/notify.ts). */
		notify: jsonb('notify').$type<Record<string, boolean>>().notNull().default({})
	},
	(t) => [
		uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`),
		uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`)
	]
);

/**
 * Lavori liberi: mansioni non regolamentate, scelte dal giocatore, che danno l'occupazione
 * nella scheda e una paga accreditata in banca (ogni `salaryIntervalHours` dell'economia).
 */
export const jobs = pgTable(
	'jobs',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		pay: integer('pay').notNull().default(0),
		/** Icona (chiave di src/lib/job-icons.ts), mostrata in scheda, elenco lavori e presenti. */
		icon: text('icon').notNull().default('briefcase'),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Se falso nessuno può più sceglierlo; chi lo fa già lo conserva (con la paga). */
		isOpen: boolean('is_open').notNull().default(true),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('jobs_name_lower_idx').on(sql`lower(${t.name})`), check('jobs_pay_nonneg', sql`${t.pay} >= 0`)]
);

/** Personaggi: chi gioca nel mondo. */
export const characters = pgTable(
	'characters',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		surname: text('surname'),
		bio: text('bio'),
		/** Scheda: aspetto fisico (l'unica parte che si "vede" in gioco). */
		appearance: text('appearance'),
		/** Scheda: carattere e modi di fare. */
		personality: text('personality'),
		/** Scheda: storia passata. Pubblica o riservata secondo le regole del gioco. */
		background: text('background'),
		/** Scheda: spazio OFF GAME del giocatore (note, disponibilità, preferenze di gioco). */
		offGame: text('off_game'),
		/** Scheda: dati anagrafici (età, nascita, altezza...), campi definiti in src/lib/profile.ts. */
		profile: jsonb('profile').$type<Record<string, string>>().notNull().default({}),
		/** Immagine del presta-volto. */
		portrait: text('portrait'),
		/** Avatar quadrato (link HTTPS) per bacheche, chat e mappa. */
		avatar: text('avatar'),
		/** Nome del presta-volto (attore, illustrazione...). */
		portraitCredit: text('portrait_credit'),
		/** Il giocatore ha già distribuito i punti iniziali delle caratteristiche. */
		statsAllocated: boolean('stats_allocated').notNull().default(false),
		/** Punti esperienza già spesi per migliorare il personaggio. */
		xpSpent: integer('xp_spent').notNull().default(0),
		/** Denaro in tasca (contanti). */
		money: integer('money').notNull().default(0),
		/** Denaro sul conto in banca. */
		bank: integer('bank').notNull().default(0),
		/** Lavoro libero scelto dal giocatore (Uffici → Lavori): dà l'occupazione e una paga periodica. */
		jobId: integer('job_id').references((): AnyPgColumn => jobs.id, { onDelete: 'set null' }),
		/** Ultima paga del lavoro ritirata (il conteggio continua anche cambiando lavoro). */
		lastJobPayAt: timestamp('last_job_pay_at', { withTimezone: true }),
		createdAt: createdAt(),
		lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
		/** Cancellazione "morbida": il PG sparisce dal gioco ma resta nei log e nelle giocate. */
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [
		uniqueIndex('characters_name_lower_idx').on(sql`lower(${t.name})`),
		index('characters_user_idx').on(t.userId),
		// Il denaro non può mai andare sotto zero, nemmeno con due richieste simultanee.
		check('characters_money_nonneg', sql`${t.money} >= 0 and ${t.bank} >= 0`)
	]
);

/** Sessioni di accesso. Si salva solo l'hash del token, mai il token stesso. */
export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** Il personaggio con cui si sta giocando in questa sessione. */
		activeCharacterId: integer('active_character_id').references(() => characters.id, {
			onDelete: 'set null'
		}),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: createdAt(),
		ip: text('ip'),
		userAgent: text('user_agent')
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

/** Ruoli: insiemi di capacità assegnabili agli utenti. */
export const roles = pgTable(
	'roles',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		capabilities: text('capabilities')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		/** Ruolo di sistema: non può essere cancellato (es. Amministratore). */
		isSystem: boolean('is_system').notNull().default(false),
		/** Assegnato automaticamente ai nuovi iscritti. */
		isDefault: boolean('is_default').notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('roles_name_lower_idx').on(sql`lower(${t.name})`)]
);

export const userRoles = pgTable(
	'user_roles',
	{
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		roleId: integer('role_id')
			.notNull()
			.references(() => roles.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.userId, t.roleId] })]
);

/** Impostazioni del sito modificabili dal pannello di gestione. */
export const settings = pgTable('settings', {
	key: text('key').primaryKey(),
	value: jsonb('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Registro delle azioni rilevanti (accessi, modifiche amministrative...). */
export const auditLog = pgTable(
	'audit_log',
	{
		id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
		actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
		action: text('action').notNull(),
		targetType: text('target_type'),
		targetId: text('target_id'),
		details: jsonb('details'),
		ip: text('ip'),
		createdAt: createdAt()
	},
	(t) => [
		index('audit_log_created_idx').on(t.createdAt),
		index('audit_log_actor_idx').on(t.actorUserId)
	]
);

// ---------------------------------------------------------------------------
// Mondo di gioco
// ---------------------------------------------------------------------------

/** Mappe: immagini su cui sono posizionati i luoghi. */
export const maps = pgTable('maps', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	/** Nome del file immagine caricato (servito da /media/...). */
	image: text('image'),
		/** Versioni dell'immagine per tema (id del tema → file in /media); se manca, si usa `image`. */
		themeImages: jsonb('theme_images').$type<Record<string, string>>().notNull().default({}),
	/** La mappa su cui arrivano i personaggi al primo ingresso. */
	isStart: boolean('is_start').notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	/** Clima usato per il meteo automatico (vedi src/lib/weather.ts); null = nessun meteo. */
	climate: text('climate'),
	/** Meteo deciso a mano dallo staff (es. "Tempesta di sabbia"), valido fino a weatherOverrideUntil. */
	weatherOverride: text('weather_override'),
	weatherOverrideUntil: timestamp('weather_override_until', { withTimezone: true }),
	/**
	 * Distretto: mappa "figlia" di un'altra (es. Watson dentro Night City).
	 * L'area è il rettangolo occupato sull'immagine della mappa madre, in percentuale.
	 * Senza un'immagine propria, il distretto mostra quel pezzo dell'immagine della madre, ingrandito.
	 */
	parentMapId: integer('parent_map_id').references((): AnyPgColumn => maps.id, { onDelete: 'set null' }),
	areaX: real('area_x'),
	areaY: real('area_y'),
	areaW: real('area_w'),
	areaH: real('area_h'),
	/** Forma libera del distretto (poligono, in percentuale): è l'area cliccabile; l'area sopra ne è il rettangolo. */
	shape: jsonb('shape').$type<{ points: [number, number][]; label?: [number, number] }>(),
	createdAt: createdAt()
});

/**
 * Luoghi. Un luogo di tipo "chat" è una locazione dove si gioca;
 * un luogo di tipo "map_link" è un collegamento verso un'altra mappa (es. "Porta della città").
 */
export const locations = pgTable(
	'locations',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		mapId: integer('map_id')
			.notNull()
			.references(() => maps.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		image: text('image'),
		kind: text('kind', { enum: ['chat', 'map_link'] }).notNull().default('chat'),
		linkedMapId: integer('linked_map_id').references(() => maps.id, { onDelete: 'set null' }),
		/** Posizione sulla mappa, in percentuale (0-100) della larghezza e dell'altezza. */
		x: real('x'),
		y: real('y'),
		isActive: boolean('is_active').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Stanza privata: si entra solo prenotandola (o su invito di chi l'ha prenotata). */
		isPrivate: boolean('is_private').notNull().default(false),
		/** Costo di un'ora di prenotazione (0 = gratis). */
		hourlyPrice: integer('hourly_price').notNull().default(0),
		/** Ore massime per prenotazione. */
		maxHours: integer('max_hours').notNull().default(4),
		createdAt: createdAt()
	},
	(t) => [index('locations_map_idx').on(t.mapId)]
);

/** Messaggi della chat di un luogo. */
export const chatMessages = pgTable(
	'chat_messages',
	{
		id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
		locationId: integer('location_id')
			.notNull()
			.references(() => locations.id, { onDelete: 'cascade' }),
		/** Personaggio che scrive (null per i messaggi di sistema). */
		characterId: integer('character_id').references(() => characters.id, { onDelete: 'set null' }),
		/** Account che ha scritto: resta tracciato anche per i messaggi Master e PNG. */
		authorUserId: integer('author_user_id').references(() => users.id, { onDelete: 'set null' }),
		kind: text('kind', { enum: ['action', 'whisper', 'master', 'npc', 'dice', 'check', 'system', 'item'] }).notNull(),
		/** Quest in corso quando il messaggio è stato scritto (per le giocate e i PX). */
		questId: integer('quest_id').references((): AnyPgColumn => quests.id, { onDelete: 'set null' }),
		/** Tag di posizione dentro il luogo, es. "TAVOLO VERDE". */
		tag: text('tag'),
		/** Nome mostrato per i PNG. */
		npcName: text('npc_name'),
		/** Destinatario dei sussurri. */
		recipientCharacterId: integer('recipient_character_id').references(() => characters.id, {
			onDelete: 'set null'
		}),
		body: text('body').notNull(),
		/** Dati aggiuntivi (es. risultati dei dadi). */
		meta: jsonb('meta'),
		createdAt: createdAt(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		deletedByUserId: integer('deleted_by_user_id').references(() => users.id, { onDelete: 'set null' })
	},
	(t) => [
		index('chat_messages_location_idx').on(t.locationId, t.id),
		index('chat_messages_character_idx').on(t.characterId),
		index('chat_messages_created_idx').on(t.createdAt)
	]
);

/** Dove si trova ogni personaggio e quando è stato visto l'ultima volta. */
export const characterPresence = pgTable(
	'character_presence',
	{
		characterId: integer('character_id')
			.primaryKey()
			.references(() => characters.id, { onDelete: 'cascade' }),
		mapId: integer('map_id').references(() => maps.id, { onDelete: 'set null' }),
		locationId: integer('location_id').references(() => locations.id, { onDelete: 'set null' }),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
		/** Ultimo intervento in chat: serve a mostrare la turnazione. */
		lastPostAt: timestamp('last_post_at', { withTimezone: true })
	},
	(t) => [index('character_presence_location_idx').on(t.locationId)]
);

// ---------------------------------------------------------------------------
// Regole di gioco (sistema ibrido: descrittivo nel gioco libero, numerico in quest)
// ---------------------------------------------------------------------------

/** Caratteristiche del personaggio (es. Forza, Destrezza), definite dallo staff. */
export const stats = pgTable('stats', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	/** Valore di partenza, prima di distribuire i punti. */
	minValue: integer('min_value').notNull().default(1),
	/** Valore massimo raggiungibile. */
	maxValue: integer('max_value').notNull().default(10),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: createdAt()
});

/** Abilità, eventualmente legate a una caratteristica che si somma nelle prove. */
export const skills = pgTable('skills', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	statId: integer('stat_id').references(() => stats.id, { onDelete: 'set null' }),
	maxRank: integer('max_rank').notNull().default(5),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: createdAt()
});

export const characterStats = pgTable(
	'character_stats',
	{
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		statId: integer('stat_id')
			.notNull()
			.references(() => stats.id, { onDelete: 'cascade' }),
		value: integer('value').notNull()
	},
	(t) => [primaryKey({ columns: [t.characterId, t.statId] })]
);

export const characterSkills = pgTable(
	'character_skills',
	{
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		skillId: integer('skill_id')
			.notNull()
			.references(() => skills.id, { onDelete: 'cascade' }),
		rank: integer('rank').notNull()
	},
	(t) => [primaryKey({ columns: [t.characterId, t.skillId] })]
);

/** Quest: episodio di trama guidato da un Master in un luogo. Durante la quest vale il sistema numerico. */
export const quests = pgTable(
	'quests',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		locationId: integer('location_id')
			.notNull()
			.references(() => locations.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		masterUserId: integer('master_user_id').references(() => users.id, { onDelete: 'set null' }),
		masterCharacterId: integer('master_character_id').references(() => characters.id, { onDelete: 'set null' }),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		endedAt: timestamp('ended_at', { withTimezone: true }),
		/** Quando il Master ha assegnato i PX di fine quest. */
		xpAwardedAt: timestamp('xp_awarded_at', { withTimezone: true })
	},
	(t) => [
		index('quests_location_idx').on(t.locationId),
		// Al massimo una quest aperta per luogo.
		uniqueIndex('quests_one_active_idx').on(t.locationId).where(sql`${t.endedAt} is null`)
	]
);

/** Punti esperienza assegnati (o tolti) ai personaggi, con il motivo. */
export const xpAwards = pgTable(
	'xp_awards',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		amount: integer('amount').notNull(),
		reason: text('reason').notNull(),
		awardedByUserId: integer('awarded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
		questId: integer('quest_id').references(() => quests.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [index('xp_awards_character_idx').on(t.characterId)]
);

// ---------------------------------------------------------------------------
// Social: missive, bacheche, gilde
// ---------------------------------------------------------------------------

/** Conversazione privata tra due personaggi. ON game (tra personaggi) oppure OFF game (tra giocatori). */
export const messageThreads = pgTable('message_threads', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	subject: text('subject').notNull(),
	onGame: boolean('on_game').notNull().default(true),
	createdAt: createdAt(),
	lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow()
});

export const messageParticipants = pgTable(
	'message_participants',
	{
		threadId: integer('thread_id')
			.notNull()
			.references(() => messageThreads.id, { onDelete: 'cascade' }),
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		/** Ultima lettura: i messaggi più recenti sono "non letti". */
		lastReadAt: timestamp('last_read_at', { withTimezone: true }),
		/** Archiviata da questo partecipante: torna visibile se arriva un nuovo messaggio. */
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		/**
		 * Eliminata (a mano o in automatico) da questo partecipante: i messaggi fino a qui non li vede più.
		 * Se arriva un messaggio nuovo la conversazione ricompare, solo con i messaggi successivi.
		 * Quando tutti i partecipanti l'hanno eliminata, i messaggi vengono cancellati davvero.
		 */
		clearedAt: timestamp('cleared_at', { withTimezone: true })
	},
	(t) => [primaryKey({ columns: [t.threadId, t.characterId] }), index('message_participants_character_idx').on(t.characterId)]
);

export const privateMessages = pgTable(
	'private_messages',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		threadId: integer('thread_id')
			.notNull()
			.references(() => messageThreads.id, { onDelete: 'cascade' }),
		senderCharacterId: integer('sender_character_id').references(() => characters.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('private_messages_thread_idx').on(t.threadId, t.id)]
);

/** Gilde: gruppi organizzati (mercantili, religiosi, militari, politici, criminali...). */
export const guilds = pgTable(
	'guilds',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		name: text('name').notNull(),
		/** Tipo libero, es. "Religiosa", "Mercantile". */
		category: text('category').notNull().default(''),
		description: text('description').notNull().default(''),
		statute: text('statute').notNull().default(''),
		symbol: text('symbol'),
		/** Icona (chiave di src/lib/job-icons.ts) mostrata in scheda e tra i presenti; porta alla pagina della gilda. */
		icon: text('icon').notNull().default('shield'),
		/** Come si entra: libero, su candidatura, solo su invito dei capi. */
		joinMode: text('join_mode', { enum: ['open', 'apply', 'closed'] }).notNull().default('apply'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('guilds_name_lower_idx').on(sql`lower(${t.name})`)]
);

/** Gradi interni di una gilda. Livello più alto = grado più importante. */
export const guildRanks = pgTable(
	'guild_ranks',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		level: integer('level').notNull(),
		/** I membri con questo grado possono gestire la gilda (accettare, promuovere, espellere chi sta sotto). */
		canManage: boolean('can_manage').notNull().default(false),
		/** Stipendio versato in banca a ogni periodo (impostato dallo staff). */
		salary: integer('salary').notNull().default(0)
	},
	(t) => [index('guild_ranks_guild_idx').on(t.guildId)]
);

export const guildMembers = pgTable(
	'guild_members',
	{
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		rankId: integer('rank_id')
			.notNull()
			.references(() => guildRanks.id, { onDelete: 'restrict' }),
		joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
		/** Ultimo stipendio ritirato per questa gilda. */
		lastSalaryAt: timestamp('last_salary_at', { withTimezone: true })
	},
	(t) => [primaryKey({ columns: [t.guildId, t.characterId] }), index('guild_members_character_idx').on(t.characterId)]
);

export const guildApplications = pgTable(
	'guild_applications',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		message: text('message').notNull().default(''),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('guild_applications_unique_idx').on(t.guildId, t.characterId)]
);

/** Bacheche (forum). Sezione ON GAME: si scrive come personaggio. OFF GAME: come giocatore. */
export const boards = pgTable('boards', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	section: text('section', { enum: ['on', 'off'] }).notNull().default('off'),
	/** Chi può leggere: tutti, solo i membri di una gilda, solo lo staff. */
	visibility: text('visibility', { enum: ['all', 'guild', 'staff'] }).notNull().default('all'),
	guildId: integer('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
	/** Solo lo staff (o i capi, per le bacheche di gilda) apre nuove discussioni. */
	staffOnlyThreads: boolean('staff_only_threads').notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: createdAt()
});

export const boardThreads = pgTable(
	'board_threads',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		boardId: integer('board_id')
			.notNull()
			.references(() => boards.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		authorUserId: integer('author_user_id').references(() => users.id, { onDelete: 'set null' }),
		authorCharacterId: integer('author_character_id').references(() => characters.id, { onDelete: 'set null' }),
		isPinned: boolean('is_pinned').notNull().default(false),
		isLocked: boolean('is_locked').notNull().default(false),
		createdAt: createdAt(),
		lastPostAt: timestamp('last_post_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('board_threads_board_idx').on(t.boardId, t.lastPostAt)]
);

export const boardPosts = pgTable(
	'board_posts',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		threadId: integer('thread_id')
			.notNull()
			.references(() => boardThreads.id, { onDelete: 'cascade' }),
		authorUserId: integer('author_user_id').references(() => users.id, { onDelete: 'set null' }),
		/** Valorizzato nelle bacheche ON GAME: il personaggio che scrive. */
		authorCharacterId: integer('author_character_id').references(() => characters.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		createdAt: createdAt(),
		editedAt: timestamp('edited_at', { withTimezone: true }),
		hiddenAt: timestamp('hidden_at', { withTimezone: true }),
		hiddenByUserId: integer('hidden_by_user_id').references(() => users.id, { onDelete: 'set null' })
	},
	(t) => [index('board_posts_thread_idx').on(t.threadId, t.id)]
);

/** Ultima lettura di ogni discussione per account: serve a evidenziare le novità. */
export const boardReads = pgTable(
	'board_reads',
	{
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		threadId: integer('thread_id')
			.notNull()
			.references(() => boardThreads.id, { onDelete: 'cascade' }),
		readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.userId, t.threadId] })]
);

// ---------------------------------------------------------------------------
// Strumenti per i Master: esiti, giocate, segnalazioni
// ---------------------------------------------------------------------------

/** Richiesta di esito: il giocatore chiede ai Master l'esito di un'azione fuori chat. */
export const esiti = pgTable(
	'esiti',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
		/** Il Master che se ne occupa. */
		masterUserId: integer('master_user_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
		closedAt: timestamp('closed_at', { withTimezone: true }),
		/** Ultima lettura del giocatore e del Master, per evidenziare le novità. */
		playerReadAt: timestamp('player_read_at', { withTimezone: true }),
		masterReadAt: timestamp('master_read_at', { withTimezone: true })
	},
	(t) => [index('esiti_character_idx').on(t.characterId), index('esiti_status_idx').on(t.status, t.lastActivityAt)]
);

export const esitoMessages = pgTable(
	'esito_messages',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		esitoId: integer('esito_id')
			.notNull()
			.references(() => esiti.id, { onDelete: 'cascade' }),
		authorUserId: integer('author_user_id').references(() => users.id, { onDelete: 'set null' }),
		fromMaster: boolean('from_master').notNull().default(false),
		/** Racconto ON game (azione del personaggio o esito del Master). */
		body: text('body').notNull().default(''),
		/** Note OFF game: chiarimenti tra giocatore e Master. */
		offNote: text('off_note'),
		/** Prova tirata dal Master: risultato e difficoltà. */
		check: jsonb('check'),
		createdAt: createdAt()
	},
	(t) => [index('esito_messages_esito_idx').on(t.esitoId, t.id)]
);

/** Giocata registrata: copia permanente di un tratto di chat. */
export const giocate = pgTable(
	'giocate',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		title: text('title').notNull(),
		locationId: integer('location_id').references(() => locations.id, { onDelete: 'set null' }),
		locationName: text('location_name').notNull(),
		questId: integer('quest_id').references(() => quests.id, { onDelete: 'set null' }),
		createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
		createdByCharacterId: integer('created_by_character_id').references(() => characters.id, { onDelete: 'set null' }),
		fromAt: timestamp('from_at', { withTimezone: true }).notNull(),
		toAt: timestamp('to_at', { withTimezone: true }).notNull(),
		/** Messaggi copiati al momento della registrazione (senza sussurri né messaggi nascosti). */
		messages: jsonb('messages').notNull(),
		/** Id dei personaggi che hanno scritto nella giocata. */
		participantIds: integer('participant_ids').array().notNull(),
		/** Visibile a tutti gli iscritti oppure solo a partecipanti e staff. */
		isPublic: boolean('is_public').notNull().default(false),
		/** Inviata ai Master per la revisione (ed eventuali PX). */
		reviewRequestedAt: timestamp('review_requested_at', { withTimezone: true }),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
		reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
		reviewNote: text('review_note'),
		createdAt: createdAt()
	},
	(t) => [index('giocate_created_idx').on(t.createdAt)]
);

/** Segnalazione allo staff di un contenuto (messaggio in chat, bacheca, missiva, scheda). */
export const reports = pgTable(
	'reports',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		reporterUserId: integer('reporter_user_id').references(() => users.id, { onDelete: 'set null' }),
		targetType: text('target_type', { enum: ['chat_message', 'board_post', 'private_message', 'character'] }).notNull(),
		targetId: integer('target_id').notNull(),
		/** Copia del contenuto al momento della segnalazione. */
		snapshot: jsonb('snapshot').notNull(),
		reason: text('reason').notNull(),
		status: text('status', { enum: ['open', 'in_progress', 'closed'] }).notNull().default('open'),
		handledByUserId: integer('handled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
		resolution: text('resolution'),
		createdAt: createdAt(),
		closedAt: timestamp('closed_at', { withTimezone: true })
	},
	(t) => [index('reports_status_idx').on(t.status, t.createdAt)]
);

export type User = typeof users.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type GameMap = typeof maps.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Stat = typeof stats.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type Quest = typeof quests.$inferSelect;
export type Guild = typeof guilds.$inferSelect;
export type GuildRank = typeof guildRanks.$inferSelect;
export type Board = typeof boards.$inferSelect;

// ---------------------------------------------------------------------------
// Economia: oggetti, inventario, denaro, stanze private
// ---------------------------------------------------------------------------

/** Bonus di un oggetto equipaggiato: si somma alle prove in quest su quella caratteristica o abilità. */
export type ItemBonus = { statId?: number; skillId?: number; value: number };

/** Catalogo degli oggetti, definito dallo staff. */
/** Negozi del mercato: ognuno vende i propri oggetti (items.shopId). */
export const shops = pgTable(
	'shops',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		name: text('name').notNull(),
		/** Cosa vende, in poche parole (es. "Forniture mediche"): fa capire il negozio a colpo d'occhio. */
		tagline: text('tagline').notNull().default(''),
		description: text('description').notNull().default(''),
		/** Icona (chiave di src/lib/job-icons.ts). */
		icon: text('icon').notNull().default('stall'),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Se falso il negozio è chiuso: non si vede e non vende. */
		isOpen: boolean('is_open').notNull().default(true),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('shops_name_lower_idx').on(sql`lower(${t.name})`)]
);

export const items = pgTable(
	'items',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		/** Negozio che lo vende (null = «Altri articoli»). */
		shopId: integer('shop_id').references(() => shops.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		image: text('image'),
		/** Categoria libera (es. "Armi", "Abiti", "Medicinali"): raggruppa il mercato. */
		category: text('category').notNull().default(''),
		/** Dove si indossa (vedi ITEM_SLOTS in src/lib/economy.ts); "none" = non si equipaggia. */
		slot: text('slot').notNull().default('none'),
		price: integer('price').notNull().default(0),
		/** In vendita al mercato. */
		forSale: boolean('for_sale').notNull().default(false),
		/** Pezzi disponibili al mercato (null = illimitati). */
		stock: integer('stock'),
		/** Si può rivendere al mercato. */
		sellable: boolean('sellable').notNull().default(true),
		/** Si consuma usandolo (es. una pozione, un medikit). */
		consumable: boolean('consumable').notNull().default(false),
		bonuses: jsonb('bonuses').$type<ItemBonus[]>().notNull().default([]),
		/** Archiviato: non si vende né si assegna più, ma resta a chi lo possiede. */
		archived: boolean('archived').notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [check('items_stock_nonneg', sql`${t.stock} is null or ${t.stock} >= 0`)]
);

/**
 * Oggetti posseduti. Gli oggetti da equipaggiare hanno una riga per pezzo (quantità 1);
 * gli altri si accumulano in una sola riga con la quantità.
 */
export const characterItems = pgTable(
	'character_items',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		itemId: integer('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		quantity: integer('quantity').notNull().default(1),
		equipped: boolean('equipped').notNull().default(false),
		acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('character_items_character_idx').on(t.characterId),
		check('character_items_quantity_pos', sql`${t.quantity} > 0`)
	]
);

/** Movimenti di denaro: ogni variazione di contanti o conto lascia una riga. */
export const moneyLog = pgTable(
	'money_log',
	{
		id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
		characterId: integer('character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		/** Variazione (negativa se il denaro esce). */
		amount: integer('amount').notNull(),
		account: text('account', { enum: ['cash', 'bank'] }).notNull(),
		kind: text('kind', {
			enum: ['start', 'deposit', 'withdraw', 'transfer_in', 'transfer_out', 'salary', 'purchase', 'sale', 'staff', 'room']
		}).notNull(),
		counterpartyCharacterId: integer('counterparty_character_id').references(() => characters.id, { onDelete: 'set null' }),
		note: text('note').notNull().default(''),
		createdAt: createdAt()
	},
	(t) => [index('money_log_character_idx').on(t.characterId, t.id)]
);

/** Prenotazioni delle stanze private. */
export const roomBookings = pgTable(
	'room_bookings',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		locationId: integer('location_id')
			.notNull()
			.references(() => locations.id, { onDelete: 'cascade' }),
		ownerCharacterId: integer('owner_character_id')
			.notNull()
			.references(() => characters.id, { onDelete: 'cascade' }),
		invitedIds: integer('invited_ids')
			.array()
			.notNull()
			.default(sql`'{}'::int[]`),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		createdAt: createdAt()
	},
	(t) => [index('room_bookings_location_idx').on(t.locationId, t.endsAt)]
);

// ---------------------------------------------------------------------------
// Pagine informative (Guida, Regolamento, Ambientazione...) modificabili dallo staff
// ---------------------------------------------------------------------------

export const pages = pgTable(
	'pages',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		/** Indirizzo della pagina: /pagine/<slug>. */
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		/** Testo con formattazione semplice (titoli #, **grassetto**, *corsivo*, elenchi, link). */
		body: text('body').notNull().default(''),
		/** Mostrata nei link in fondo a ogni pagina. */
		inFooter: boolean('in_footer').notNull().default(true),
		/** Leggibile anche da chi non ha un account (es. regolamento prima di iscriversi). */
		isPublic: boolean('is_public').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' })
	},
	(t) => [uniqueIndex('pages_slug_idx').on(t.slug)]
);
