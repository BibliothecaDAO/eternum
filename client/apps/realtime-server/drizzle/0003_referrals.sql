CREATE TABLE "referrals" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"referee_address" varchar(66) NOT NULL,
	"referrer_address" varchar(66) NOT NULL,
	"referee_username" varchar(64),
	"referrer_username" varchar(64),
	"source" varchar(32) DEFAULT 'unknown' NOT NULL,
	"has_played" boolean DEFAULT false NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"last_checked_block" bigint,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referee_address_unique" ON "referrals" USING btree ("referee_address");--> statement-breakpoint
CREATE INDEX "referrals_referrer_address_idx" ON "referrals" USING btree ("referrer_address");--> statement-breakpoint
CREATE INDEX "referrals_verified_idx" ON "referrals" USING btree ("has_played","games_played");