-- Realms' occasional news emails (scripts/comeback-email.ts). An account that follows its email's stop link is never
-- sent another (server/news-email-opt-out.ts writes newsEmailOptOutAt, in milliseconds like walletLinkedAt). A send
-- reserves its account here before the email goes and marks it sent after, so neither a rerun nor a parallel run sends
-- it twice; a row left reserved is an attempt whose outcome is unknown, never retried by the script.
alter table "user" add column "newsEmailOptOutAt" integer;

create table "news_email_sends" (
  "campaign" text not null,
  "realmsId" text not null references "user" ("realmsId") on delete cascade,
  "variant" text not null,
  "status" text not null check ("status" in ('reserved', 'sent')),
  "reserved_at" integer not null,
  "resend_id" text,
  "sent_at" integer,
  primary key ("campaign", "realmsId")
);
