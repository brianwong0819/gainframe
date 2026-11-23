CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"table_id" text,
	"name" text NOT NULL,
	"protein_per100_g" double precision NOT NULL,
	"kcal_per100_g" double precision NOT NULL,
	"servings" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "foods_user_version_idx" ON "foods" USING btree ("user_id","server_version");