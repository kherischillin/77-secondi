-- Il riquadro del presta-volto passa da 240×320 a 350×500 dove era rimasto il vecchio valore.
UPDATE "settings" SET "value" = '350'::jsonb WHERE "key" = 'portraitMaxWidth' AND "value" = '240'::jsonb;--> statement-breakpoint
UPDATE "settings" SET "value" = '500'::jsonb WHERE "key" = 'portraitMaxHeight' AND "value" = '320'::jsonb;
