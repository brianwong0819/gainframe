CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"protein_mode" text NOT NULL,
	"protein_value" double precision NOT NULL,
	"kcal_target" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "profiles_user_version_idx" ON "profiles" USING btree ("user_id","server_version");