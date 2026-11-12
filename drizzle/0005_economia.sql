CREATE TABLE "character_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "character_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"character_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_items_quantity_pos" CHECK ("character_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image" text,
	"category" text DEFAULT '' NOT NULL,
	"slot" text DEFAULT 'none' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"for_sale" boolean DEFAULT false NOT NULL,
	"stock" integer,
	"sellable" boolean DEFAULT true NOT NULL,
	"consumable" boolean DEFAULT false NOT NULL,
	"bonuses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_stock_nonneg" CHECK ("items"."stock" is null or "items"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "money_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "money_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"character_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"account" text NOT NULL,
	"kind" text NOT NULL,
	"counterparty_character_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_bookings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "room_bookings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"location_id" integer NOT NULL,
	"owner_character_id" integer NOT NULL,
	"invited_ids" integer[] DEFAULT '{}'::int[] NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "money" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "bank" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_members" ADD COLUMN "last_salary_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guild_ranks" ADD COLUMN "salary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "hourly_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "max_hours" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "climate" text;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "weather_override" text;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "weather_override_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "character_items" ADD CONSTRAINT "character_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_items" ADD CONSTRAINT "character_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_log" ADD CONSTRAINT "money_log_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_log" ADD CONSTRAINT "money_log_counterparty_character_id_characters_id_fk" FOREIGN KEY ("counterparty_character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_owner_character_id_characters_id_fk" FOREIGN KEY ("owner_character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_items_character_idx" ON "character_items" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "money_log_character_idx" ON "money_log" USING btree ("character_id","id");--> statement-breakpoint
CREATE INDEX "room_bookings_location_idx" ON "room_bookings" USING btree ("location_id","ends_at");--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_money_nonneg" CHECK ("characters"."money" >= 0 and "characters"."bank" >= 0);