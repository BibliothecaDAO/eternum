CREATE TABLE ledger_link_writes (
  transaction_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  account TEXT NOT NULL,
  previous_account TEXT NOT NULL,
  previous_wallet TEXT NOT NULL,
  authority TEXT NOT NULL
);
CREATE INDEX wallet_link_history_wallet_id ON wallet_link_history(wallet,id);
CREATE INDEX wallet_link_history_account_id ON wallet_link_history(account,id);
