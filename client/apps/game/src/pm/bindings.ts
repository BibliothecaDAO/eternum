export interface MarketOutcome {
  id?: string | number;
  label?: string;
  probability?: number;
  price?: number;
  odds?: number;
  [key: string]: unknown;
}

export interface MarketTypVariant {
  variant: Record<string, unknown>;
}

export interface Market {
  market_id?: string | number | bigint;
  title?: string;
  terms?: string;
  oracle?: string;
  collateral_token?: string;
  created_at?: string | number | bigint;
  start_at?: string | number | bigint;
  resolve_at?: string | number | bigint;
  resolved_at?: string | number | bigint;
  tvl?: string | number | bigint;
  outcomes?: MarketOutcome[];
  typ?: MarketTypVariant;
  status?: string;
  [key: string]: unknown;
}

export interface MarketCreated {
  market_id?: string | number | bigint;
  title?: string;
  terms?: string;
  created_at?: string | number | bigint;
  [key: string]: unknown;
}

export interface VaultDenominator {
  market_id?: string | number | bigint;
  value?: string | number | bigint;
  [key: string]: unknown;
}

export interface VaultNumerator {
  market_id?: string | number | bigint;
  value?: string | number | bigint;
  index?: number | bigint;
  [key: string]: unknown;
}
