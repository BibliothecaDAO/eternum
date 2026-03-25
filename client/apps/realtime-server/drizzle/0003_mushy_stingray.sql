CREATE TABLE "agent_events" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"agent_id" varchar(191) NOT NULL,
	"seq" integer NOT NULL,
	"type" varchar(191) NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"agent_id" varchar(191) NOT NULL,
	"lease_id" varchar(191) NOT NULL,
	"wake_reason" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"snapshot_version" integer,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"mutating_actions" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_code" varchar(191),
	"error_message" varchar(2000)
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"agent_id" varchar(191) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"session_ref" varchar(191),
	"auth_url" text,
	"expires_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"error_message" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_thread_messages" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"thread_id" varchar(191) NOT NULL,
	"sender_type" varchar(16) NOT NULL,
	"sender_id" varchar(191) NOT NULL,
	"content" varchar(2000) NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_threads" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"agent_id" varchar(191) NOT NULL,
	"owner_id" varchar(191) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_world_chat_rate_limits" (
	"agent_id" varchar(191) PRIMARY KEY NOT NULL,
	"last_published_at" timestamp with time zone,
	"window_started_at" timestamp with time zone,
	"window_message_count" integer DEFAULT 0 NOT NULL,
	"metadata_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"kind" varchar(16) NOT NULL,
	"owner_type" varchar(32) NOT NULL,
	"owner_id" varchar(191) NOT NULL,
	"world_id" varchar(191) NOT NULL,
	"display_name" varchar(64) NOT NULL,
	"desired_state" varchar(16) NOT NULL,
	"execution_state" varchar(32) NOT NULL,
	"runtime_config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subscription_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_provider" varchar(191) NOT NULL,
	"model_id" varchar(191) NOT NULL,
	"auth_mode" varchar(32) NOT NULL,
	"account_address" varchar(68),
	"setup_status" varchar(16) DEFAULT 'none' NOT NULL,
	"setup_auth_url" text,
	"setup_expires_at" timestamp with time zone,
	"setup_error_message" varchar(2000),
	"autonomy_enabled" boolean DEFAULT false NOT NULL,
	"autonomy_match_id" varchar(191),
	"autonomy_enabled_at" timestamp with time zone,
	"autonomy_disabled_at" timestamp with time zone,
	"steering_job_type" varchar(32),
	"steering_job_status" varchar(32),
	"steering_job_label" varchar(64),
	"steering_job_summary" varchar(2000),
	"steering_job_config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"steering_started_at" timestamp with time zone,
	"steering_updated_at" timestamp with time zone,
	"steering_ended_at" timestamp with time zone,
	"current_snapshot_version" integer,
	"next_wake_at" timestamp with time zone,
	"last_run_started_at" timestamp with time zone,
	"last_run_finished_at" timestamp with time zone,
	"last_error_code" varchar(191),
	"last_error_message" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_events" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"world_id" varchar(191) NOT NULL,
	"snapshot_version" integer,
	"type" varchar(191) NOT NULL,
	"subject_id" varchar(191),
	"zone_id" varchar(191),
	"dedupe_key" varchar(191) NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_snapshots" (
	"world_id" varchar(191) NOT NULL,
	"version" integer NOT NULL,
	"snapshot_key" text NOT NULL,
	"snapshot_summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_events_agent_seq_unique_idx" ON "agent_events" USING btree ("agent_id","seq");--> statement-breakpoint
CREATE INDEX "agent_events_agent_created_idx" ON "agent_events" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_idx" ON "agent_runs" USING btree ("agent_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_lease_unique_idx" ON "agent_runs" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_agent_idx" ON "agent_sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_thread_messages_thread_idx" ON "agent_thread_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_threads_agent_owner_unique_idx" ON "agent_threads" USING btree ("agent_id","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_owner_world_unique_idx" ON "agents" USING btree ("kind","owner_type","owner_id","world_id","display_name");--> statement-breakpoint
CREATE INDEX "agents_world_execution_idx" ON "agents" USING btree ("world_id","execution_state");--> statement-breakpoint
CREATE UNIQUE INDEX "world_events_dedupe_unique_idx" ON "world_events" USING btree ("world_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "world_events_world_created_idx" ON "world_events" USING btree ("world_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "world_snapshots_world_version_unique_idx" ON "world_snapshots" USING btree ("world_id","version");