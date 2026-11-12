ALTER TABLE "maps" ADD COLUMN "parent_map_id" integer;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "area_x" real;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "area_y" real;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "area_w" real;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "area_h" real;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_parent_map_id_maps_id_fk" FOREIGN KEY ("parent_map_id") REFERENCES "public"."maps"("id") ON DELETE set null ON UPDATE no action;