CREATE TABLE "operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"bank_transaction_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undoable_until" timestamp with time zone,
	"undone_at" timestamp with time zone,
	"undone_by_user_id" uuid,
	"undo_operation_id" integer,
	"summary" text NOT NULL,
	"details" jsonb,
	CONSTRAINT "operations_kind_check" CHECK ("operations"."kind" IN ('confirm_match', 'discard_transaction', 'restore_transaction', 'create_enrollment', 'add_discount', 'undo'))
);
--> statement-breakpoint
ALTER TABLE "bank_transactions" DROP CONSTRAINT "bank_transactions_status_check";--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD COLUMN "discarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD COLUMN "discarded_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "operation_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "voided_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_undone_by_user_id_users_id_fk" FOREIGN KEY ("undone_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_undo_operation_id_operations_id_fk" FOREIGN KEY ("undo_operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operations_actor_user_id_idx" ON "operations" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "operations_bank_transaction_id_idx" ON "operations" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "operations_kind_idx" ON "operations" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "operations_created_at_idx" ON "operations" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_discarded_by_user_id_users_id_fk" FOREIGN KEY ("discarded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_operation_id_idx" ON "payments" USING btree ("operation_id");--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_status_check" CHECK ("bank_transactions"."status" IN ('matched', 'unmatched', 'discarded'));