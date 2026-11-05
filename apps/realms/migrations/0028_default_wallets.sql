-- Each account's default wallet: a Ready (Argent) 0.5 account owned by the passkey the player made on this app, with the
-- Realms guardian as its guardian (server/default-wallet-plugin.ts). Its address is fixed by the passkey it was made
-- with (deploy_key_x), the origin and relying party it was made on, the guardian key and the Realms id. Its owner today
-- is credential_id / public_key_x: the same passkey, until a recovery hands the wallet to a new one.
CREATE TABLE default_wallets (
  realms_id TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  deploy_key_x TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  public_key_x TEXT NOT NULL,
  origin TEXT NOT NULL,
  rp_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Each sponsored recovery step (start, finish, cancel) a default wallet sent, by its outside-execution nonce, on its UTC
-- day: the per-account daily allowance counts them (server/wallet-recovery.ts), and a resubmission of the same
-- execution (same nonce) is not counted again. Sends pay their own fee and are not counted.
CREATE TABLE sponsored_executions (
  realms_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (realms_id, nonce)
);

-- A lost passkey's recovery, one attempt per account at a time (server/wallet-recovery.ts): reserved before anything is
-- built, it keeps the new passkey (the chain stores only its GUID) and the escape's execution: its outside nonce and
-- window, to prove later whether it ran, and its transaction once the paymaster answers. Whether an escape stands is the
-- wallet's own answer on chain.
CREATE TABLE wallet_recoveries (
  realms_id TEXT PRIMARY KEY,
  attempt TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  public_key_x TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  nonce TEXT,
  execute_before INTEGER,
  transaction_hash TEXT
);

-- A notice is about the payout wallet (as before) or about a recovery of the default wallet.
ALTER TABLE wallet_change_notices ADD COLUMN kind TEXT NOT NULL DEFAULT 'payout';
