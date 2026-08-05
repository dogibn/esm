ALTER TABLE "operations" DROP CONSTRAINT "operations_kind_check";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_kind_check" CHECK ("operations"."kind" IN ('confirm_match', 'discard_transaction', 'restore_transaction', 'create_enrollment', 'add_discount', 'user_access', 'undo'));