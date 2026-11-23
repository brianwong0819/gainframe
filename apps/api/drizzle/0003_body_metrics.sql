CREATE TABLE "body_metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"weight_kg" double precision NOT NULL,
	"body_fat_pct" double precision,
	"skeletal_muscle_kg" double precision,
	"fat_mass_kg" double precision,
	"source" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "height_cm" double precision;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "activity_level" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "phase" text;--> statement-breakpoint
CREATE INDEX "body_metrics_user_version_idx" ON "body_metrics" USING btree ("user_id","server_version");