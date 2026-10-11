CREATE TABLE wallet_link_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT NOT NULL,
  wallet TEXT NOT NULL,
  linked_at INTEGER,
  ready_at INTEGER,
  replaced_at INTEGER
);
CREATE INDEX wallet_link_history_account_time ON wallet_link_history(account, ready_at, replaced_at);
CREATE UNIQUE INDEX wallet_link_history_current ON wallet_link_history(account) WHERE replaced_at IS NULL;
INSERT INTO wallet_link_history(account,wallet,linked_at,ready_at)
  SELECT "realmsId","address","walletLinkedAt","walletLinkedAt"+86400000 FROM "user"
  WHERE "address" IS NOT NULL AND "realmsId" IS NOT NULL;
