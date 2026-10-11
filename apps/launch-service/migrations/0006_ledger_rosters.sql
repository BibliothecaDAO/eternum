-- The frozen L2 wallet/account mapping outlives launch retries and later payout-wallet changes.
CREATE TABLE blitz_ledger_rosters (
  chain_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  roster TEXT NOT NULL,
  PRIMARY KEY (chain_id, game_name)
);
