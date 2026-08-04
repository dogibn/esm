CREATE TABLE "discount_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"value" numeric(12, 4),
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "discount_types_name_unique" UNIQUE("name"),
	CONSTRAINT "discount_types_unit_check" CHECK ("discount_types"."unit" IN ('percent', 'mnt')),
	CONSTRAINT "discount_types_value_check" CHECK ("discount_types"."value" IS NULL OR ("discount_types"."value" >= 0 AND ("discount_types"."unit" <> 'percent' OR "discount_types"."value" <= 100)))
);
--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "discount_type_id" integer;--> statement-breakpoint
-- New columns are added nullable / with a temporary default so existing
-- (pre-catalog) discount rows can be backfilled before NOT NULL is enforced.
-- Legacy discounts were flat MNT amounts summed in any order, so: unit='mnt',
-- value = the stored MNT amount, and position = their id order per enrollment.
ALTER TABLE "discounts" ADD COLUMN "unit" text DEFAULT 'mnt' NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "value" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "discounts" SET "value" = "amount" WHERE "value" IS NULL;--> statement-breakpoint
WITH "ordered" AS (
	SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "enrollment_id" ORDER BY "id") - 1) AS "pos"
	FROM "discounts"
)
UPDATE "discounts" SET "position" = "ordered"."pos"
FROM "ordered" WHERE "discounts"."id" = "ordered"."id" AND "discounts"."position" IS NULL;--> statement-breakpoint
ALTER TABLE "discounts" ALTER COLUMN "value" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
-- 'mnt' default was only a backfill convenience; the app always sets unit.
ALTER TABLE "discounts" ALTER COLUMN "unit" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_discount_type_id_discount_types_id_fk" FOREIGN KEY ("discount_type_id") REFERENCES "public"."discount_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discounts_discount_type_id_idx" ON "discounts" USING btree ("discount_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_enrollment_id_position_unique" ON "discounts" USING btree ("enrollment_id","position");--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_unit_check" CHECK ("discounts"."unit" IN ('percent', 'mnt'));
