ALTER TYPE "public"."dataset_type" ADD VALUE IF NOT EXISTS 'custom';--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "custom_catalog" jsonb;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "custom_catalog" jsonb;
