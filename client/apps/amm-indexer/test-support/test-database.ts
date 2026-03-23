import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/schema";

const SCHEMA_SQL = `
CREATE TABLE pools (
  id text PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token_address text NOT NULL,
  lp_token_address text NOT NULL,
  lords_reserve numeric(78, 0) NOT NULL DEFAULT '0',
  token_reserve numeric(78, 0) NOT NULL DEFAULT '0',
  total_lp_supply numeric(78, 0) NOT NULL DEFAULT '0',
  lp_fee_num numeric(78, 0) NOT NULL,
  lp_fee_denom numeric(78, 0) NOT NULL,
  protocol_fee_num numeric(78, 0) NOT NULL,
  protocol_fee_denom numeric(78, 0) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  block_number bigint NOT NULL,
  tx_hash text NOT NULL
);
CREATE UNIQUE INDEX pools_token_address_idx ON pools (token_address);

CREATE TABLE swaps (
  id text PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token_address text NOT NULL,
  user_address text NOT NULL,
  token_in text NOT NULL,
  token_out text NOT NULL,
  amount_in numeric(78, 0) NOT NULL,
  amount_out numeric(78, 0) NOT NULL,
  protocol_fee numeric(78, 0) NOT NULL,
  price_before_swap numeric(40, 18),
  price_after_swap numeric(40, 18),
  block_number bigint NOT NULL,
  block_timestamp timestamp NOT NULL,
  tx_hash text NOT NULL,
  event_index integer NOT NULL
);
CREATE INDEX swaps_token_address_idx ON swaps (token_address);
CREATE INDEX swaps_user_address_idx ON swaps (user_address);
CREATE INDEX swaps_block_timestamp_idx ON swaps (block_timestamp);

CREATE TABLE liquidity_events (
  id text PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token_address text NOT NULL,
  provider_address text NOT NULL,
  event_type text NOT NULL,
  lords_amount numeric(78, 0) NOT NULL,
  token_amount numeric(78, 0) NOT NULL,
  lp_amount numeric(78, 0) NOT NULL,
  block_number bigint NOT NULL,
  block_timestamp timestamp NOT NULL,
  tx_hash text NOT NULL,
  event_index integer NOT NULL
);
CREATE INDEX liquidity_events_token_address_idx ON liquidity_events (token_address);
CREATE INDEX liquidity_events_provider_address_idx ON liquidity_events (provider_address);
CREATE INDEX liquidity_events_block_timestamp_idx ON liquidity_events (block_timestamp);

CREATE TABLE pool_fee_changes (
  id text PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token_address text NOT NULL,
  lp_fee_num numeric(78, 0) NOT NULL,
  lp_fee_denom numeric(78, 0) NOT NULL,
  protocol_fee_num numeric(78, 0) NOT NULL,
  protocol_fee_denom numeric(78, 0) NOT NULL,
  block_number bigint NOT NULL,
  block_timestamp timestamp NOT NULL,
  tx_hash text NOT NULL
);

CREATE TABLE price_candles (
  id text PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token_address text NOT NULL,
  interval text NOT NULL,
  open_time timestamp NOT NULL,
  close_time timestamp NOT NULL,
  open numeric(40, 18) NOT NULL,
  high numeric(40, 18) NOT NULL,
  low numeric(40, 18) NOT NULL,
  close numeric(40, 18) NOT NULL,
  volume numeric(78, 0) NOT NULL DEFAULT '0',
  trade_count integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX price_candles_unique_idx ON price_candles (token_address, interval, open_time);

CREATE TABLE pool_snapshots (
  id text PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token_address text NOT NULL,
  lords_reserve numeric(78, 0) NOT NULL,
  token_reserve numeric(78, 0) NOT NULL,
  total_lp_supply numeric(78, 0) NOT NULL,
  block_number bigint NOT NULL,
  block_timestamp timestamp NOT NULL
);
CREATE INDEX pool_snapshots_token_timestamp_idx ON pool_snapshots (token_address, block_timestamp);
`;

export async function createTestAmmDatabase() {
  const client = new PGlite();
  await client.exec(SCHEMA_SQL);

  return {
    db: drizzle(client, { schema }),
    async close() {
      await client.close();
    },
  };
}
