CREATE TABLE "jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"pay" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_pay_nonneg" CHECK ("jobs"."pay" >= 0)
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "job_id" integer;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "last_job_pay_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_name_lower_idx" ON "jobs" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;