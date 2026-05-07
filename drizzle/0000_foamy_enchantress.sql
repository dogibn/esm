CREATE TABLE "academic_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"academic_year_id" integer NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_years_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"sender_name" text,
	"sender_account" text,
	"memo" text,
	"amount" bigint NOT NULL,
	"transaction_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_transactions_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "bank_transactions_status_check" CHECK ("bank_transactions"."status" IN ('matched', 'unmatched'))
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"academic_year_id" integer,
	"academic_term_id" integer,
	"fee_name" text NOT NULL,
	"amount" bigint NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charges_scope_check" CHECK (("charges"."academic_year_id" IS NOT NULL AND "charges"."academic_term_id" IS NULL) OR ("charges"."academic_year_id" IS NULL AND "charges"."academic_term_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "club_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"fee_structure_id" integer NOT NULL,
	"academic_term_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"academic_year_id" integer NOT NULL,
	"grade_id" integer NOT NULL,
	"status" text NOT NULL,
	"student_category" text NOT NULL,
	"tuition_contract_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_status_check" CHECK ("enrollments"."status" IN ('active', 'inactive', 'withdrawn')),
	CONSTRAINT "enrollments_student_category_check" CHECK ("enrollments"."student_category" IN ('new', 'old'))
);
--> statement-breakpoint
CREATE TABLE "fee_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"fee_name" text NOT NULL,
	"data" jsonb NOT NULL,
	"academic_term_id" integer,
	"effective_from" date NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grade_levels_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"grade_level_id" integer NOT NULL,
	"academic_year_id" integer NOT NULL,
	"teacher_name" text NOT NULL,
	"teacher_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_transaction_id" integer NOT NULL,
	"charge_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"parent_email" text,
	"parent_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('accountant', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_enrollments" ADD CONSTRAINT "club_enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_enrollments" ADD CONSTRAINT "club_enrollments_fee_structure_id_fee_structures_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_enrollments" ADD CONSTRAINT "club_enrollments_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "academic_terms_is_current_unique" ON "academic_terms" USING btree ("is_current") WHERE "academic_terms"."is_current" = TRUE;--> statement-breakpoint
CREATE INDEX "academic_terms_academic_year_id_idx" ON "academic_terms" USING btree ("academic_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_is_current_unique" ON "academic_years" USING btree ("is_current") WHERE "academic_years"."is_current" = TRUE;--> statement-breakpoint
CREATE INDEX "bank_transactions_unmatched_idx" ON "bank_transactions" USING btree ("status") WHERE "bank_transactions"."status" = 'unmatched';--> statement-breakpoint
CREATE INDEX "bank_transactions_transaction_at_idx" ON "bank_transactions" ("transaction_at" DESC);--> statement-breakpoint
CREATE INDEX "charges_student_id_academic_year_id_idx" ON "charges" USING btree ("student_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "charges_student_id_academic_term_id_idx" ON "charges" USING btree ("student_id","academic_term_id");--> statement-breakpoint
CREATE INDEX "charges_fee_name_idx" ON "charges" USING btree ("fee_name");--> statement-breakpoint
CREATE UNIQUE INDEX "club_enrollments_student_id_fee_structure_id_unique" ON "club_enrollments" USING btree ("student_id","fee_structure_id");--> statement-breakpoint
CREATE INDEX "discounts_enrollment_id_idx" ON "discounts" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_student_id_academic_year_id_unique" ON "enrollments" USING btree ("student_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "enrollments_academic_year_id_grade_id_idx" ON "enrollments" USING btree ("academic_year_id","grade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structures_fee_name_academic_term_id_effective_from_unique" ON "fee_structures" USING btree ("fee_name","academic_term_id","effective_from");--> statement-breakpoint
CREATE INDEX "fee_structures_fee_name_active_idx" ON "fee_structures" USING btree ("fee_name") WHERE "fee_structures"."superseded_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "grades_academic_year_id_name_unique" ON "grades" USING btree ("academic_year_id","name");--> statement-breakpoint
CREATE INDEX "grades_academic_year_id_grade_level_id_idx" ON "grades" USING btree ("academic_year_id","grade_level_id");--> statement-breakpoint
CREATE INDEX "payments_charge_id_idx" ON "payments" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "payments_bank_transaction_id_idx" ON "payments" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "students_last_name_first_name_idx" ON "students" USING btree ("last_name","first_name");