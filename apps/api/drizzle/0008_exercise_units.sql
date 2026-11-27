CREATE TABLE "exercise_units" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"exercise_id" uuid NOT NULL,
	"weight_unit" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "exercise_units_user_version_idx" ON "exercise_units" USING btree ("user_id","server_version");