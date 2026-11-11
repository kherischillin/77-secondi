CREATE TABLE "character_skills" (
	"character_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "character_skills_character_id_skill_id_pk" PRIMARY KEY("character_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "character_stats" (
	"character_id" integer NOT NULL,
	"stat_id" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "character_stats_character_id_stat_id_pk" PRIMARY KEY("character_id","stat_id")
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"location_id" integer NOT NULL,
	"title" text NOT NULL,
	"master_user_id" integer,
	"master_character_id" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"xp_awarded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"stat_id" integer,
	"max_rank" integer DEFAULT 5 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stats" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"min_value" integer DEFAULT 1 NOT NULL,
	"max_value" integer DEFAULT 10 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_awards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "xp_awards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"character_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"awarded_by_user_id" integer,
	"quest_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "appearance" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "personality" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "background" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "portrait" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "portrait_credit" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "stats_allocated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "xp_spent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "quest_id" integer;--> statement-breakpoint
ALTER TABLE "character_skills" ADD CONSTRAINT "character_skills_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_skills" ADD CONSTRAINT "character_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_stat_id_stats_id_fk" FOREIGN KEY ("stat_id") REFERENCES "public"."stats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_master_user_id_users_id_fk" FOREIGN KEY ("master_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_master_character_id_characters_id_fk" FOREIGN KEY ("master_character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_stat_id_stats_id_fk" FOREIGN KEY ("stat_id") REFERENCES "public"."stats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_awards" ADD CONSTRAINT "xp_awards_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_awards" ADD CONSTRAINT "xp_awards_awarded_by_user_id_users_id_fk" FOREIGN KEY ("awarded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_awards" ADD CONSTRAINT "xp_awards_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quests_location_idx" ON "quests" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quests_one_active_idx" ON "quests" USING btree ("location_id") WHERE "quests"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "xp_awards_character_idx" ON "xp_awards" USING btree ("character_id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE set null ON UPDATE no action;