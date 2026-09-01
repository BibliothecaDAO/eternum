CREATE TABLE "player_blocks" (
	"blocker_id" varchar(191) NOT NULL,
	"blocked_id" varchar(191) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_blocks_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE INDEX "player_blocks_blocked_idx" ON "player_blocks" USING btree ("blocked_id");
