-- Each account's default wallet: a Ready (Argent) 0.5 account owned by the passkey the player made on this app, with the
-- Realms guardian as its guardian (server/default-wallets.ts). The address is fixed by the passkey, the origin and
-- relying party it was made on, the guardian key and the Realms id, so the row never changes once written.
CREATE TABLE default_wallets (
  realms_id TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  credential_id TEXT NOT NULL,
  public_key_x TEXT NOT NULL,
  origin TEXT NOT NULL,
  rp_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Sponsored calls each default wallet made on each UTC day, against the paymaster's per-account cap.
CREATE TABLE wallet_sponsored_calls (
  realms_id TEXT NOT NULL,
  day TEXT NOT NULL,
  calls INTEGER NOT NULL,
  PRIMARY KEY (realms_id, day)
);
