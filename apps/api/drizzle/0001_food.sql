CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"meal_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"grams" double precision NOT NULL,
	"protein_g" double precision NOT NULL,
	"kcal" double precision NOT NULL,
	"source" text NOT NULL,
	"ai_raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"eaten_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"meal_type" text NOT NULL,
	"name" text,
	"photo_key" text
);
--> statement-breakpoint
CREATE INDEX "meal_items_user_version_idx" ON "meal_items" USING btree ("user_id","server_version");--> statement-breakpoint
CREATE INDEX "meals_user_version_idx" ON "meals" USING btree ("user_id","server_version");