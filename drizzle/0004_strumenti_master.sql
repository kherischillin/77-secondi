CREATE TABLE "esiti" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "esiti_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"character_id" integer NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"master_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"player_read_at" timestamp with time zone,
	"master_read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "esito_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "esito_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"esito_id" integer NOT NULL,
	"author_user_id" integer,
	"from_master" boolean DEFAULT false NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"off_note" text,
	"check" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giocate" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "giocate_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"location_id" integer,
	"location_name" text NOT NULL,
	"quest_id" integer,
	"created_by_user_id" integer,
	"created_by_character_id" integer,
	"from_at" timestamp with time zone NOT NULL,
	"to_at" timestamp with time zone NOT NULL,
	"messages" jsonb NOT NULL,
	"participant_ids" integer[] NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"review_requested_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" integer,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reporter_user_id" integer,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by_user_id" integer,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "esiti" ADD CONSTRAINT "esiti_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esiti" ADD CONSTRAINT "esiti_master_user_id_users_id_fk" FOREIGN KEY ("master_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esito_messages" ADD CONSTRAINT "esito_messages_esito_id_esiti_id_fk" FOREIGN KEY ("esito_id") REFERENCES "public"."esiti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esito_messages" ADD CONSTRAINT "esito_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giocate" ADD CONSTRAINT "giocate_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giocate" ADD CONSTRAINT "giocate_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giocate" ADD CONSTRAINT "giocate_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giocate" ADD CONSTRAINT "giocate_created_by_character_id_characters_id_fk" FOREIGN KEY ("created_by_character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giocate" ADD CONSTRAINT "giocate_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_user_id_users_id_fk" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "esiti_character_idx" ON "esiti" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "esiti_status_idx" ON "esiti" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE INDEX "esito_messages_esito_idx" ON "esito_messages" USING btree ("esito_id","id");--> statement-breakpoint
CREATE INDEX "giocate_created_idx" ON "giocate" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");