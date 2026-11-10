-- Each deleted account, written in its deletion's own transaction (server/account-deletion.ts). `chat_closed_at` stays
-- empty until the account's chat inbox is emptied and its open chat sockets are closed: the deletion request does that
-- at once, and the Worker's minute cron finishes any that a failure or a stopped Worker left.
CREATE TABLE account_deletions (
  realms_id TEXT PRIMARY KEY NOT NULL,
  deleted_at INTEGER NOT NULL,
  chat_closed_at INTEGER
);
