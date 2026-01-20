CREATE TABLE "avatar_generation_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"cartridge_username" text NOT NULL,
	"prompt" text NOT NULL,
	"fal_job_id" text,
	"status" text NOT NULL,
	"error_message" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"cartridge_username" text PRIMARY KEY NOT NULL,
	"player_address" text NOT NULL,
	"avatar_url" text,
	"avatar_generation_prompt" text,
	"fal_image_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generation_count" integer DEFAULT 0 NOT NULL,
	"last_generation_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "avatar_generation_logs_username_idx" ON "avatar_generation_logs" USING btree ("cartridge_username");--> statement-breakpoint
CREATE INDEX "avatar_generation_logs_created_at_idx" ON "avatar_generation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "avatar_generation_logs_status_idx" ON "avatar_generation_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "player_profiles_player_address_idx" ON "player_profiles" USING btree ("player_address");--> statement-breakpoint
CREATE INDEX "player_profiles_created_at_idx" ON "player_profiles" USING btree ("created_at");