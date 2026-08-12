CREATE TYPE "public"."dataset_type" AS ENUM('large', 'small');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('waiting', 'playing', 'results');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('host', 'guest');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('playing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."round_member_status" AS ENUM('choosing', 'completed', 'removed');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('liked', 'disliked');--> statement-breakpoint
CREATE TABLE "rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "host_user_id" uuid NOT NULL,
  "selected_dataset" "dataset_type" DEFAULT 'large' NOT NULL,
  "status" "room_status" DEFAULT 'waiting' NOT NULL,
  "current_round_id" uuid,
  "revision" integer DEFAULT 0 NOT NULL,
  "last_activity_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "room_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "role" "member_role" NOT NULL,
  "joined_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "room_members_user_id_unique" UNIQUE("user_id"),
  CONSTRAINT "room_members_room_user_unique" UNIQUE("room_id", "user_id")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL,
  "sequence" integer NOT NULL,
  "catalog_version" text NOT NULL,
  "catalog_hash" text NOT NULL,
  "dataset_type" "dataset_type" NOT NULL,
  "status" "round_status" DEFAULT 'playing' NOT NULL,
  "result_snapshot" jsonb,
  "revision" integer DEFAULT 0 NOT NULL,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  CONSTRAINT "rounds_room_sequence_unique" UNIQUE("room_id", "sequence")
);
--> statement-breakpoint
CREATE TABLE "round_members" (
  "round_id" uuid NOT NULL,
  "room_member_id" uuid NOT NULL,
  "status" "round_member_status" DEFAULT 'choosing' NOT NULL,
  "completed_at" timestamptz,
  CONSTRAINT "round_members_pk" PRIMARY KEY("round_id", "room_member_id")
);
--> statement-breakpoint
CREATE TABLE "decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "round_id" uuid NOT NULL,
  "room_member_id" uuid NOT NULL,
  "catalog_item_id" text NOT NULL,
  "decision" "decision" NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "decisions_round_member_item_unique" UNIQUE("round_id", "room_member_id", "catalog_item_id")
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "scope" text NOT NULL,
  "key" text NOT NULL,
  "request_hash" text NOT NULL,
  "response_status" integer NOT NULL,
  "response_body" jsonb NOT NULL,
  "expires_at" timestamptz NOT NULL,
  CONSTRAINT "idempotency_actor_scope_key_unique" UNIQUE("actor_user_id", "scope", "key")
);
--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_members" ADD CONSTRAINT "round_members_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_members" ADD CONSTRAINT "round_members_room_member_id_room_members_id_fk" FOREIGN KEY ("room_member_id") REFERENCES "public"."room_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rooms_last_activity_idx" ON "rooms" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "room_members_room_id_idx" ON "room_members" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "decisions_round_member_idx" ON "decisions" USING btree ("round_id", "room_member_id");
