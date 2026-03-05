import { getPredictionMarketConfig } from "../../prediction-market-config";

/**
 * PM SQL API Client
 * Handles SQL queries against the PM Torii instance
 */

// Filter types for server-side filtering
export enum MarketStatusFilter {
  All = "All",
  Open = "Open",
  Resolvable = "Resolvable",
  Resolved = "Resolved",
}

export enum MarketTypeFilter {
  All = "All",
  Binary = "Binary",
  Categorical = "Categorical",
}

export interface MarketFiltersParams {
  status: MarketStatusFilter;
  type: MarketTypeFilter;
  oracle: string;
}

const ZERO_U64_HEX = "0x0000000000000000";

function toPaddedU64Hex(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ZERO_U64_HEX;
  return `0x${Math.floor(value).toString(16).padStart(16, "0")}`;
}

/**
 * Build SQL WHERE clause for market filters
 * Returns conditions to be used in SQL queries
 */
function buildFilterWhereClause(filters: MarketFiltersParams, now: number): string {
  // Torii stores Cairo u64 timestamps as zero-padded hex strings (0x...).
  // Numeric CAST on those values can collapse to 0, so compare normalized hex strings directly.
  const nowHex = toPaddedU64Hex(now);
  const conditions: string[] = [`LOWER(m.start_at) < '${nowHex}'`];

  // Status filter
  switch (filters.status) {
    case MarketStatusFilter.Open:
      conditions.push(`LOWER(m.resolve_at) > '${nowHex}'`);
      conditions.push(`LOWER(m.resolved_at) = '${ZERO_U64_HEX}'`);
      break;
    case MarketStatusFilter.Resolvable:
      conditions.push(`LOWER(m.resolve_at) < '${nowHex}'`);
      conditions.push(`LOWER(m.resolved_at) = '${ZERO_U64_HEX}'`);
      break;
    case MarketStatusFilter.Resolved:
      conditions.push(`LOWER(m.resolved_at) > '${ZERO_U64_HEX}'`);
      break;
    // MarketStatusFilter.All - no extra conditions needed
  }

  // Type filter
  if (filters.type === MarketTypeFilter.Binary) {
    conditions.push(`m."typ.Binary" IS NOT NULL`);
  } else if (filters.type === MarketTypeFilter.Categorical) {
    conditions.push(`m."typ.Categorical" IS NOT NULL`);
  }

  // Oracle filter
  if (filters.oracle !== "All") {
    // Escape single quotes in oracle address to prevent SQL injection
    const safeOracle = filters.oracle.replace(/'/g, "''");
    conditions.push(`m.oracle = '${safeOracle}'`);
  }

  return conditions.join(" AND ");
}

// SQL query utilities (matching patterns from @bibliothecadao/torii)
function buildApiUrl(baseUrl: string, query: string): string {
  return `${baseUrl}?query=${encodeURIComponent(query)}`;
}

async function fetchWithErrorHandling<T>(url: string, errorMessage: string): Promise<T[]> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${errorMessage}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!Array.isArray(result)) {
    throw new Error(`${errorMessage}: Expected array response but got ${typeof result}`);
  }

  return result as T[];
}

function extractFirstOrNull<T>(sqlResult: T[]): T | null {
  return sqlResult.length > 0 ? sqlResult[0] : null;
}

// Response types based on discovered schema
interface MarketRow {
  market_id: string;
  creator: string;
  created_at: string;
  question_id: string;
  condition_id: string;
  oracle: string;
  outcome_slot_count: number;
  collateral_token: string;
  model: string;
  typ: string;
  oracle_value_type: string;
  start_at: string;
  end_at: string;
  resolve_at: string;
  resolved_at: string;
  oracle_fee: number;
  creator_fee: number;
  oracle_params?: string; // JSON array of oracle parameters
  // Nested fields for typ enum
  "typ.Binary"?: string;
  "typ.Categorical"?: string;
  "typ.Categorical.Ranges"?: string;
  "typ.Categorical.ValueEq"?: string;
  // Nested fields for model enum (Vault)
  "model.Vault.fee_curve.Range.start"?: string;
  "model.Vault.fee_curve.Range.end"?: string;
  "model.Vault.fee_share_curve.Range.start"?: string;
  "model.Vault.fee_share_curve.Range.end"?: string;
  "model.Vault.funding_amount"?: string;
  "model.Vault.initial_repartition"?: string;
}

export interface VaultNumeratorRow {
  market_id: string;
  index: number;
  value: string;
}

export interface MarketWithDetailsRow extends MarketRow {
  title?: string;
  terms?: string;
  position_ids?: string;
  denominator?: string;
}

interface MarketBuyAmountRow {
  market_id: string;
  amount_in: string;
}

export interface MarketBuyOutcomeRow {
  outcome_index: string;
  amount: string;
}

interface MarketCountRow {
  total: string; // SQL returns string
}

export interface ProtocolFeesRow {
  id: string;
  token_address: string;
  accumulated_fee: string;
  claimed_fee: string;
}

// SQL Query definitions
const PM_SQL_QUERIES = {
  // Markets list with joined data (uses dynamic WHERE clause)
  // Note: Uses m.* to get all market columns including nested model fields
  MARKETS_WITH_DETAILS: `
    SELECT
      m.*,
      mc.title,
      mc.terms,
      mc.position_ids,
      vd.value as denominator
    FROM "pm-Market" m
    LEFT JOIN "pm-MarketCreated" mc ON m.market_id = mc.market_id
    LEFT JOIN "pm-VaultDenominator" vd ON m.market_id = vd.market_id
    WHERE {whereClause}
    ORDER BY m.start_at DESC
    LIMIT {limit} OFFSET {offset}
  `,

  // Markets count for pagination (uses same WHERE clause as MARKETS_WITH_DETAILS)
  MARKETS_COUNT: `
    SELECT COUNT(*) as total
    FROM "pm-Market" m
    LEFT JOIN "pm-MarketCreated" mc ON m.market_id = mc.market_id
    WHERE {whereClause}
  `,

  // Vault numerators for specific markets
  VAULT_NUMERATORS_BY_MARKETS: `
    SELECT market_id, "index", value
    FROM "pm-VaultNumerator"
    WHERE market_id IN ({marketIds})
    ORDER BY market_id, "index"
  `,

  // Raw buy amounts (hex-encoded uint256) for all-time volume aggregation in the UI.
  MARKET_BUY_AMOUNTS_BY_MARKETS: `
    SELECT market_id, amount_in
    FROM "pm-MarketBuy"
    WHERE market_id IN ({marketIds})
  `,

  MARKET_BUY_OUTCOMES_BY_MARKET_AND_ACCOUNT: `
    SELECT outcome_index, amount
    FROM "pm-MarketBuy"
    WHERE market_id = '{marketId}'
      AND LOWER(account_address) = LOWER('{accountAddress}')
  `,

  MARKET_BUY_UNIQUE_ACCOUNTS_COUNT_BY_MARKET: `
    SELECT COUNT(DISTINCT account_address) as total
    FROM "pm-MarketBuy"
    WHERE market_id = '{marketId}'
  `,

  // Find market by prize distribution address in oracle_params
  // oracle_params is a JSON array where index 1 contains the prize address
  MARKET_BY_PRIZE_ADDRESS: `
    SELECT
      m.*,
      mc.title,
      mc.terms,
      mc.position_ids,
      vd.value as denominator
    FROM "pm-Market" m
    LEFT JOIN "pm-MarketCreated" mc ON m.market_id = mc.market_id
    LEFT JOIN "pm-VaultDenominator" vd ON m.market_id = vd.market_id
    WHERE m.oracle_params LIKE '%{prizeAddress}%'
    ORDER BY m.start_at DESC
    LIMIT 1
  `,

  PROTOCOL_FEES_BY_ID: `
    SELECT id, token_address, accumulated_fee, claimed_fee
    FROM "pm-ProtocolFees"
    WHERE id = '{id}'
    LIMIT 1
  `,
} as const;

/**
 * PM SQL API Client class
 */
class PmSqlApi {
  private readonly baseUrl: string;

  constructor(toriiUrl?: string) {
    this.baseUrl = `${toriiUrl ?? getPredictionMarketConfig().toriiUrl}/sql`;
  }

  /**
   * Fetch markets with details (joined with MarketCreated and VaultDenominator)
   * Now supports server-side filtering for accurate pagination
   */
  async fetchMarketsWithDetails(
    filters: MarketFiltersParams,
    now: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<MarketWithDetailsRow[]> {
    const whereClause = buildFilterWhereClause(filters, now);
    const query = PM_SQL_QUERIES.MARKETS_WITH_DETAILS.replace("{whereClause}", whereClause)
      .replace("{limit}", limit.toString())
      .replace("{offset}", offset.toString());

    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<MarketWithDetailsRow>(url, "Failed to fetch markets");
  }

  /**
   * Fetch total count of markets matching filters (for pagination)
   */
  async fetchMarketsCount(filters: MarketFiltersParams, now: number): Promise<number> {
    const whereClause = buildFilterWhereClause(filters, now);
    const query = PM_SQL_QUERIES.MARKETS_COUNT.replace("{whereClause}", whereClause);

    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<MarketCountRow>(url, "Failed to fetch markets count");
    return results[0] ? parseInt(results[0].total, 10) : 0;
  }

  /**
   * Fetch vault numerators for specific market IDs
   */
  async fetchVaultNumeratorsByMarkets(marketIds: string[]): Promise<VaultNumeratorRow[]> {
    if (marketIds.length === 0) return [];

    const quotedIds = marketIds.map((id) => `'${id}'`).join(",");
    const query = PM_SQL_QUERIES.VAULT_NUMERATORS_BY_MARKETS.replace("{marketIds}", quotedIds);

    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<VaultNumeratorRow>(url, "Failed to fetch vault numerators");
  }

  /**
   * Fetch raw buy amounts for specific market IDs.
   * `amount_in` is returned as hex and should be aggregated with BigInt client-side.
   */
  async fetchMarketBuyAmountsByMarkets(marketIds: string[]): Promise<MarketBuyAmountRow[]> {
    if (marketIds.length === 0) return [];

    const quotedIds = marketIds.map((id) => `'${id}'`).join(",");
    const query = PM_SQL_QUERIES.MARKET_BUY_AMOUNTS_BY_MARKETS.replace("{marketIds}", quotedIds);

    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<MarketBuyAmountRow>(url, "Failed to fetch market buy amounts");
  }

  /**
   * Fetch account-scoped buy rows for a single market.
   * Results are aggregated client-side because amount fields are hex-encoded values.
   */
  async fetchMarketBuyOutcomesByMarketAndAccount(
    marketId: string,
    accountAddress: string,
  ): Promise<MarketBuyOutcomeRow[]> {
    const safeMarketId = marketId.replace(/'/g, "''").toLowerCase();
    const safeAddress = accountAddress.replace(/'/g, "''").toLowerCase();
    const query = PM_SQL_QUERIES.MARKET_BUY_OUTCOMES_BY_MARKET_AND_ACCOUNT.replace("{marketId}", safeMarketId).replace(
      "{accountAddress}",
      safeAddress,
    );

    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<MarketBuyOutcomeRow>(url, "Failed to fetch market buy outcomes");
  }

  /**
   * Fetch count of unique buyer accounts for a market.
   */
  async fetchMarketBuyUniqueAccountsCountByMarket(marketId: string): Promise<number> {
    const safeMarketId = marketId.replace(/'/g, "''").toLowerCase();
    const query = PM_SQL_QUERIES.MARKET_BUY_UNIQUE_ACCOUNTS_COUNT_BY_MARKET.replace("{marketId}", safeMarketId);
    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<MarketCountRow>(
      url,
      "Failed to fetch market buy unique account count",
    );
    return results[0] ? parseInt(results[0].total, 10) : 0;
  }

  /**
   * Fetch market by prize distribution address (found in oracle_params)
   * This is optimized for finding the game's prediction market without fetching all markets
   */
  async fetchMarketByPrizeAddress(prizeAddress: string): Promise<MarketWithDetailsRow | null> {
    // Escape single quotes in address to prevent SQL injection
    const safeAddress = prizeAddress.replace(/'/g, "''");
    const query = PM_SQL_QUERIES.MARKET_BY_PRIZE_ADDRESS.replace("{prizeAddress}", safeAddress);
    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<MarketWithDetailsRow>(url, "Failed to fetch market by prize address");
    return extractFirstOrNull(results);
  }

  /**
   * Fetch protocol fee row by ID.
   * IDs can be market IDs, account addresses, oracle addresses, or the "PROTOCOL" sentinel.
   */
  async fetchProtocolFeesById(id: string): Promise<ProtocolFeesRow | null> {
    const safeId = id.replace(/'/g, "''").toLowerCase();
    const query = PM_SQL_QUERIES.PROTOCOL_FEES_BY_ID.replace("{id}", safeId);
    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<ProtocolFeesRow>(url, "Failed to fetch protocol fees by id");
    return extractFirstOrNull(results);
  }
}

// Singleton instance using default config
let pmSqlApiInstance: PmSqlApi | null = null;
const pmSqlApiByUrl = new Map<string, PmSqlApi>();

export function getPmSqlApi(): PmSqlApi {
  if (!pmSqlApiInstance) {
    pmSqlApiInstance = new PmSqlApi();
  }
  return pmSqlApiInstance;
}

export function getPmSqlApiForUrl(toriiUrl: string): PmSqlApi {
  const normalized = toriiUrl.replace(/\/+$/, "");
  const cached = pmSqlApiByUrl.get(normalized);
  if (cached) return cached;

  const instance = new PmSqlApi(normalized);
  pmSqlApiByUrl.set(normalized, instance);
  return instance;
}
