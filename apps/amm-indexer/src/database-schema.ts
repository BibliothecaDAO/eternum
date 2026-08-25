const INDEXER_SCHEMA_STATEMENTS = [
  `
CREATE TABLE IF NOT EXISTS factories (
  factory_address text PRIMARY KEY,
  fee_to text NOT NULL DEFAULT '0x0',
  fee_amount numeric(78, 0) NOT NULL DEFAULT '997',
  pair_count bigint NOT NULL DEFAULT 0,
  last_updated_block_number bigint NOT NULL DEFAULT 0,
  last_updated_tx_hash text NOT NULL DEFAULT '0x0',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
)`,
  "CREATE INDEX IF NOT EXISTS factories_updated_idx ON factories (last_updated_block_number)",
  `
CREATE TABLE IF NOT EXISTS pairs (
  pair_address text PRIMARY KEY,
  factory_address text NOT NULL,
  token0_address text NOT NULL,
  token1_address text NOT NULL,
  lp_token_address text NOT NULL,
  reserve0 numeric(78, 0) NOT NULL DEFAULT '0',
  reserve1 numeric(78, 0) NOT NULL DEFAULT '0',
  total_lp_supply numeric(78, 0) NOT NULL DEFAULT '0',
  created_block_number bigint NOT NULL DEFAULT 0,
  created_tx_hash text NOT NULL DEFAULT '0x0',
  last_synced_block_number bigint NOT NULL DEFAULT 0,
  last_synced_tx_hash text NOT NULL DEFAULT '0x0',
  updated_at timestamp NOT NULL DEFAULT now()
)`,
  "CREATE INDEX IF NOT EXISTS pairs_factory_idx ON pairs (factory_address)",
  "CREATE INDEX IF NOT EXISTS pairs_token0_idx ON pairs (token0_address)",
  "CREATE INDEX IF NOT EXISTS pairs_token1_idx ON pairs (token1_address)",
  `
CREATE TABLE IF NOT EXISTS factory_fee_changes (
  id text PRIMARY KEY,
  factory_address text NOT NULL,
  change_type text NOT NULL,
  old_fee_to text,
  new_fee_to text,
  old_fee_amount numeric(78, 0),
  new_fee_amount numeric(78, 0),
  block_number bigint NOT NULL,
  block_timestamp timestamp NOT NULL,
  tx_hash text NOT NULL
)`,
  "CREATE INDEX IF NOT EXISTS factory_fee_changes_factory_idx ON factory_fee_changes (factory_address, block_timestamp)",
  `
CREATE TABLE IF NOT EXISTS pair_swaps (
  id text PRIMARY KEY,
  pair_address text NOT NULL,
  factory_address text NOT NULL,
  token0_address text NOT NULL,
  token1_address text NOT NULL,
  initiator_address text NOT NULL,
  caller_address text NOT NULL,
  recipient_address text NOT NULL,
  amount0_in numeric(78, 0) NOT NULL,
  amount1_in numeric(78, 0) NOT NULL,
  amount0_out numeric(78, 0) NOT NULL,
  amount1_out numeric(78, 0) NOT NULL,
  fee_amount numeric(78, 0) NOT NULL,
  block_number bigint NOT NULL,
  block_timestamp timestamp NOT NULL,
  tx_hash text NOT NULL,
  event_index integer NOT NULL
)`,
  "CREATE INDEX IF NOT EXISTS pair_swaps_pair_idx ON pair_swaps (pair_address, block_timestamp)",
  "CREATE INDEX IF NOT EXISTS pair_swaps_initiator_idx ON pair_swaps (initiator_address)",
  `
CREATE TABLE IF NOT EXISTS pair_liquidity_events (
  id text PRIMARY KEY,
  pair_address text NOT NULL,
  factory_address text NOT NULL,
  token0_address text NOT NULL,
  token1_address text NOT NULL,
  provider_address text NOT NULL,
  event_type text NOT NULL,
  amount0 numeric(78, 0) NOT NULL,
  amount1 numeric(78, 0) NOT NULL,
  lp_amount numeric(78, 0) NOT NULL,
  block_number bigint NOT NULL,
  block_timestamp timestamp NOT NULL,
  tx_hash text NOT NULL,
  event_index integer NOT NULL
)`,
  "CREATE INDEX IF NOT EXISTS pair_liquidity_pair_idx ON pair_liquidity_events (pair_address, block_timestamp)",
  "CREATE INDEX IF NOT EXISTS pair_liquidity_provider_idx ON pair_liquidity_events (provider_address)",
  `
CREATE TABLE IF NOT EXISTS pair_lp_transfers (
  id text PRIMARY KEY,
  pair_address text NOT NULL,
  factory_address text NOT NULL,
  token0_address text NOT NULL,
  token1_address text NOT NULL,
  from_address text NOT NULL,
  to_address text NOT NULL,
  amount numeric(78, 0) NOT NULL,
  block_number bigint NOT NULL,
  block_timestamp timestamp NOT NULL,
  tx_hash text NOT NULL,
  event_index integer NOT NULL
)`,
  "CREATE INDEX IF NOT EXISTS pair_lp_transfers_pair_idx ON pair_lp_transfers (pair_address, block_timestamp)",
  "CREATE INDEX IF NOT EXISTS pair_lp_transfers_from_idx ON pair_lp_transfers (from_address)",
  "CREATE INDEX IF NOT EXISTS pair_lp_transfers_to_idx ON pair_lp_transfers (to_address)",
  `
CREATE TABLE IF NOT EXISTS pair_lp_balances (
  id text NOT NULL,
  pair_address text NOT NULL,
  owner_address text NOT NULL,
  balance numeric(78, 0) NOT NULL DEFAULT '0',
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (pair_address, owner_address)
)`,
  "ALTER TABLE pair_lp_balances ADD COLUMN IF NOT EXISTS id text",
  "UPDATE pair_lp_balances SET id = pair_address || ':' || owner_address WHERE id IS NULL OR id = ''",
  "CREATE UNIQUE INDEX IF NOT EXISTS pair_lp_balances_id_idx ON pair_lp_balances (id)",
  "CREATE INDEX IF NOT EXISTS pair_lp_balances_owner_idx ON pair_lp_balances (owner_address)",
  "CREATE INDEX IF NOT EXISTS pair_lp_balances_pair_idx ON pair_lp_balances (pair_address)",
  `
CREATE TABLE IF NOT EXISTS pair_price_candles (
  id text PRIMARY KEY,
  pair_address text NOT NULL,
  interval text NOT NULL,
  open_time timestamp NOT NULL,
  close_time timestamp NOT NULL,
  open numeric(40, 18) NOT NULL,
  high numeric(40, 18) NOT NULL,
  low numeric(40, 18) NOT NULL,
  close numeric(40, 18) NOT NULL,
  volume0 numeric(78, 0) NOT NULL DEFAULT '0',
  volume1 numeric(78, 0) NOT NULL DEFAULT '0',
  trade_count integer NOT NULL DEFAULT 0
)`,
  "CREATE INDEX IF NOT EXISTS pair_price_candles_pair_idx ON pair_price_candles (pair_address, interval, open_time)",
];

export async function ensureAmmV2DatabaseSchema(executeStatement: (statement: string) => Promise<unknown>) {
  for (const statement of INDEXER_SCHEMA_STATEMENTS) {
    await executeStatement(statement);
  }
}
