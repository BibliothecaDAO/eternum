-- Realms' occasional news emails (scripts/comeback-email.ts). An account that follows its email's stop link is never
-- sent another (server/news-email-opt-out.ts writes newsEmailOptOutAt, in milliseconds like walletLinkedAt); each
-- account a campaign has reached is recorded, so a rerun of the send skips it.
alter table "user" add column "newsEmailOptOutAt" integer;

create table "news_email_sends" (
  "campaign" text not null,
  "realmsId" text not null references "user" ("realmsId") on delete cascade,
  "variant" text not null,
  "resend_id" text,
  "sent_at" integer not null,
  primary key ("campaign", "realmsId")
);
