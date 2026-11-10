-- A push device id its own revocation token revoked, kept a day. A registration of that id that reaches the store after
-- the revocation is refused (push-subscription-store.ts), so an acknowledged revocation stays final even when the
-- device timed out or restarted before its registration request finished. Numbered past #5211's 0034 and #5216's 0035.
create table "notification_push_revocations" ("id" text not null primary key, "revokedAt" integer not null);
