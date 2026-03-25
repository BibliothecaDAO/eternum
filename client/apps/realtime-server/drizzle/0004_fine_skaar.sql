ALTER TABLE "agent_sessions" ADD COLUMN "callback_state_hash" varchar(191);--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "redirect_uri" text;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "policy_fingerprint" varchar(191);--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "session_account_address" varchar(68);--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "cartridge_username" varchar(64);--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "encrypted_signer_json" jsonb;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "encrypted_session_json" jsonb;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "key_version" varchar(32);--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "callback_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "invalidated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "invalidation_reason" varchar(2000);--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "active_session_id" varchar(191);