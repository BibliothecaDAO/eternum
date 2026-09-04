CREATE TYPE "public"."note_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"author_id" varchar(191) NOT NULL,
	"zone_id" varchar(128) NOT NULL,
	"title" varchar(120) NOT NULL,
	"content" varchar(2000) NOT NULL,
	"location" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" "note_visibility" DEFAULT 'public' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "world_chat_messages" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"zone_id" varchar(128),
	"sender_id" varchar(191) NOT NULL,
	"sender_wallet" varchar(68),
	"sender_display_name" varchar(64),
	"sender_avatar_url" text,
	"content" varchar(2000) NOT NULL,
	"location" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moderated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "direct_message_read_receipts" (
	"thread_id" varchar(191) NOT NULL,
	"message_id" varchar(191) NOT NULL,
	"reader_id" varchar(191) NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "direct_message_read_receipts_pk" PRIMARY KEY("thread_id","message_id","reader_id")
);
--> statement-breakpoint
CREATE TABLE "direct_message_threads" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"player_a_id" varchar(191) NOT NULL,
	"player_b_id" varchar(191) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"last_message_id" varchar(191),
	"last_message_at" timestamp with time zone,
	"unread_counts" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "direct_message_typing_states" (
	"thread_id" varchar(191) NOT NULL,
	"player_id" varchar(191) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "direct_message_typing_states_pk" PRIMARY KEY("thread_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"thread_id" varchar(191) NOT NULL,
	"sender_id" varchar(191) NOT NULL,
	"recipient_id" varchar(191) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "direct_message_read_receipts" ADD CONSTRAINT "direct_message_read_receipts_thread_id_direct_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_message_threads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_message_read_receipts" ADD CONSTRAINT "direct_message_read_receipts_message_id_direct_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_message_typing_states" ADD CONSTRAINT "direct_message_typing_states_thread_id_direct_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_message_threads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_thread_id_direct_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_message_threads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "notes_zone_created_idx" ON "notes" USING btree ("zone_id","created_at");--> statement-breakpoint
CREATE INDEX "notes_author_created_idx" ON "notes" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "world_chat_zone_created_idx" ON "world_chat_messages" USING btree ("zone_id","created_at");--> statement-breakpoint
CREATE INDEX "world_chat_sender_created_idx" ON "world_chat_messages" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "direct_message_read_receipts_thread_reader_idx" ON "direct_message_read_receipts" USING btree ("thread_id","reader_id");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_message_players_unique" ON "direct_message_threads" USING btree ("player_a_id","player_b_id");--> statement-breakpoint
CREATE INDEX "direct_message_typing_states_thread_idx" ON "direct_message_typing_states" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "direct_messages_thread_created_idx" ON "direct_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "direct_messages_sender_created_idx" ON "direct_messages" USING btree ("sender_id","created_at");