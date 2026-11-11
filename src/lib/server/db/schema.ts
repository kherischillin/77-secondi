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
		banReason: text('ban_reason')
	},
	(t) => [
		uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`),
		uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`)
	]
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
		/** Immagine del presta-volto. */
		portrait: text('portrait'),
		/** Nome del presta-volto (attore, illustrazione...). */
		portraitCredit: text('portrait_credit'),
		/** Il giocatore ha già distribuito i punti iniziali delle caratteristiche. */
		statsAllocated: boolean('stats_allocated').notNull().default(false),
		/** Punti esperienza già spesi per migliorare il personaggio. */
		xpSpent: integer('xp_spent').notNull().default(0),
		createdAt: createdAt(),
		lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
		/** Cancellazione "morbida": il PG sparisce dal gioco ma resta nei log e nelle giocate. */
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [
		uniqueIndex('characters_name_lower_idx').on(sql`lower(${t.name})`),
		index('characters_user_idx').on(t.userId)
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
	/** La mappa su cui arrivano i personaggi al primo ingresso. */
	isStart: boolean('is_start').notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
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
		kind: text('kind', { enum: ['action', 'whisper', 'master', 'npc', 'dice', 'check', 'system'] }).notNull(),
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
		index('chat_messages_character_idx').on(t.characterId)
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
