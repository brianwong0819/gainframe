CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"name_zh" text,
	"name_en" text,
	"muscle" text NOT NULL,
	"secondary_muscles" text[] NOT NULL,
	"equipment" text NOT NULL,
	"default_rest_s" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_days" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_day_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"superset_group" integer,
	"target_sets" integer NOT NULL,
	"reps_min" integer NOT NULL,
	"reps_max" integer NOT NULL,
	"rest_s" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"server_version" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"superset_group" integer,
	"note" text,
	"reps_min" integer,
	"reps_max" integer,
	"rest_s" integer,
	"plan_note" text
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"workout_exercise_id" uuid NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"weight_kg" double precision NOT NULL,
	"reps" integer NOT NULL,
	"rpe" double precision,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"plan_day_id" uuid,
	"local_date" date NOT NULL,
	"note" text,
	"rest_started_at" timestamp with time zone,
	"rest_ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "exercises_user_version_idx" ON "exercises" USING btree ("user_id","server_version");--> statement-breakpoint
CREATE INDEX "plan_days_user_version_idx" ON "plan_days" USING btree ("user_id","server_version");--> statement-breakpoint
CREATE INDEX "plan_items_user_version_idx" ON "plan_items" USING btree ("user_id","server_version");--> statement-breakpoint
CREATE INDEX "plans_user_version_idx" ON "plans" USING btree ("user_id","server_version");--> statement-breakpoint
CREATE INDEX "workout_exercises_user_version_idx" ON "workout_exercises" USING btree ("user_id","server_version");--> statement-breakpoint
CREATE INDEX "workout_sets_user_version_idx" ON "workout_sets" USING btree ("user_id","server_version");--> statement-breakpoint
CREATE INDEX "workouts_user_version_idx" ON "workouts" USING btree ("user_id","server_version");