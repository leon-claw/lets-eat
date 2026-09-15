ALTER TYPE "public"."dataset_type" ADD VALUE 'nearby';--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "nearby_catalog" jsonb;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "nearby_catalog" jsonb;