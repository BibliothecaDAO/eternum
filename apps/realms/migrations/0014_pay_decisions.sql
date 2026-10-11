CREATE TABLE pay_decisions (
  chain_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  account TEXT NOT NULL,
  wallet TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  amount TEXT NOT NULL,
  history_id INTEGER NOT NULL,
  evidence_time INTEGER NOT NULL,
  PRIMARY KEY(chain_id, claim_id, transaction_hash)
);
