CREATE TABLE "shops" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shops_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'stall' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "shop_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "shops_name_lower_idx" ON "shops" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;