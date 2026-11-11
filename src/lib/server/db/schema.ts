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
	text,
	timestamp,
	uniqueIndex
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

export type User = typeof users.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Role = typeof roles.$inferSelect;
