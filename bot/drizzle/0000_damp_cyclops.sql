CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text,
	"created_at" timestamp DEFAULT now(),
	"discord" text,
	"telegram" text
);
