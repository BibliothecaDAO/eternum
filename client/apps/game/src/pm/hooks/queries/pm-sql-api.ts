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

/**
 * Build SQL WHERE clause for market filters
 * Returns conditions to be used in SQL queries
 */
function buildFilterWhereClause(filters: MarketFiltersParams, now: number): string {
  const conditions: string[] = [`CAST(m.start_at AS INTEGER) < ${now}`];

  // Status filter
  switch (filters.status) {
    case MarketStatusFilter.Open:
      conditions.push(`CAST(m.resolve_at AS INTEGER) > ${now}`);
      break;
    case MarketStatusFilter.Resolvable:
      conditions.push(`CAST(m.resolve_at AS INTEGER) < ${now}`);
      conditions.push(`CAST(m.resolved_at AS INTEGER) = 0`);
      break;
    case MarketStatusFilter.Resolved:
      conditions.push(`CAST(m.resolved_at AS INTEGER) > 0`);
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
export interface MarketRow {
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
  // Nested fields for typ enum
  "typ.Binary"?: string;
  "typ.Categorical"?: string;
  "typ.Categorical.Ranges"?: string;
  "typ.Categorical.ValueEq"?: string;
}

export interface MarketCreatedRow {
  market_id: string;
  title: string;
  terms: string;
  oracle_parameters_schema: string;
  oracle_extra_parameters_schema: string;
  position_ids: string;
}

export interface VaultDenominatorRow {
  market_id: string;
  value: string;
}

export interface VaultNumeratorRow {
  market_id: string;
  index: number;
  value: string;
}

export interface VaultDenominatorEventRow {
  market_id: string;
  value: string;
  timestamp: string;
  internal_entity_id: string;
}

export interface VaultNumeratorEventRow {
  market_id: string;
  index: number;
  value: string;
  timestamp: string;
  internal_entity_id: string;
}

export interface VaultEventRow {
  event_type: "denominator" | "numerator";
  market_id: string;
  index: number | null;
  value: string;
  timestamp: string;
}

export interface MarketWithDetailsRow extends MarketRow {
  title?: string;
  terms?: string;
  position_ids?: string;
  denominator?: string;
}

export interface TokenBalanceRow {
  id: string;
  balance: string;
  account_address: string;
  contract_address: string;
  token_id: string;
}

export interface TokenRow {
  id: string;
  contract_address: string;
  name: string;
  symbol: string;
  decimals: number;
  metadata: string;
  token_id: string;
}

export interface ConditionResolutionRow {
  condition_id: string;
  oracle: string;
  question_id: string;
  outcome_slot_count: number;
  payout_numerators: string;
}

export interface MarketCountRow {
  total: string; // SQL returns string
}

// SQL Query definitions
export const PM_SQL_QUERIES = {
  // Markets list with joined data (uses dynamic WHERE clause)
  MARKETS_WITH_DETAILS: `
    SELECT
      m.market_id,
      m.creator,
      m.created_at,
      m.question_id,
      m.condition_id,
      m.oracle,
      m.outcome_slot_count,
      m.collateral_token,
      m.model,
      m.typ,
      m.oracle_value_type,
      m."typ.Binary",
      m."typ.Categorical",
      m."typ.Categorical.Ranges",
      m."typ.Categorical.ValueEq",
      m.start_at,
      m.end_at,
      m.resolve_at,
      m.resolved_at,
      m.oracle_fee,
      m.creator_fee,
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

  // Vault denominator events for a market (chart data)
  VAULT_DENOMINATOR_EVENTS: `
    SELECT market_id, value, timestamp
    FROM "pm-VaultDenominatorEvent"
    WHERE market_id = '{marketId}'
    ORDER BY timestamp ASC
  `,

  // Vault numerator events for a market (chart data)
  VAULT_NUMERATOR_EVENTS: `
    SELECT market_id, "index", value, timestamp
    FROM "pm-VaultNumeratorEvent"
    WHERE market_id = '{marketId}'
    ORDER BY "index" ASC, timestamp ASC
  `,

  // Combined vault events for a market (optimized single query for chart data)
  VAULT_EVENTS_COMBINED: `
    SELECT 'denominator' as event_type, market_id, NULL as "index", value, timestamp
    FROM "pm-VaultDenominatorEvent"
    WHERE market_id = '{marketId}'
    UNION ALL
    SELECT 'numerator' as event_type, market_id, "index", value, timestamp
    FROM "pm-VaultNumeratorEvent"
    WHERE market_id = '{marketId}'
    ORDER BY timestamp ASC
  `,

  // User token balances with token metadata
  USER_TOKEN_BALANCES: `
    SELECT
      tb.balance,
      tb.account_address,
      tb.contract_address,
      tb.token_id,
      t.metadata,
      t.name,
      t.symbol,
      t.decimals
    FROM token_balances tb
    INNER JOIN tokens t ON tb.contract_address = t.contract_address AND tb.token_id = t.token_id
    WHERE tb.account_address = '{userAddress}'
      AND tb.contract_address IN ({contractAddresses})
      AND CAST(tb.balance AS INTEGER) > 0
  `,

  // Condition resolutions
  CONDITION_RESOLUTIONS: `
    SELECT condition_id, oracle, question_id, outcome_slot_count, payout_numerators
    FROM "pm-ConditionResolution"
    WHERE condition_id IN ({conditionIds})
  `,

  // Single market detail
  MARKET_DETAIL: `
    SELECT
      m.*,
      mc.title,
      mc.terms,
      mc.position_ids,
      vd.value as denominator
    FROM "pm-Market" m
    LEFT JOIN "pm-MarketCreated" mc ON m.market_id = mc.market_id
    LEFT JOIN "pm-VaultDenominator" vd ON m.market_id = vd.market_id
    WHERE m.market_id = '{marketId}'
  `,
} as const;

/**
 * PM SQL API Client class
 */
export class PmSqlApi {
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
   * Fetch vault denominator events for chart data
   */
  async fetchVaultDenominatorEvents(marketId: string): Promise<VaultDenominatorEventRow[]> {
    const query = PM_SQL_QUERIES.VAULT_DENOMINATOR_EVENTS.replace("{marketId}", marketId);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<VaultDenominatorEventRow>(url, "Failed to fetch denominator events");
  }

  /**
   * Fetch vault numerator events for chart data
   */
  async fetchVaultNumeratorEvents(marketId: string): Promise<VaultNumeratorEventRow[]> {
    const query = PM_SQL_QUERIES.VAULT_NUMERATOR_EVENTS.replace("{marketId}", marketId);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<VaultNumeratorEventRow>(url, "Failed to fetch numerator events");
  }

  /**
   * Fetch combined vault events (denominator + numerator) in a single query
   * This is more efficient than making two separate requests
   */
  async fetchVaultEventsCombined(marketId: string): Promise<VaultEventRow[]> {
    const query = PM_SQL_QUERIES.VAULT_EVENTS_COMBINED.replace("{marketId}", marketId);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<VaultEventRow>(url, "Failed to fetch vault events");
  }

  /**
   * Fetch user token balances with metadata
   */
  async fetchUserTokenBalances(
    userAddress: string,
    contractAddresses: string[],
  ): Promise<(TokenBalanceRow & { metadata: string; name: string; symbol: string; decimals: number })[]> {
    if (contractAddresses.length === 0) return [];

    const quotedAddresses = contractAddresses.map((addr) => `'${addr}'`).join(",");
    const query = PM_SQL_QUERIES.USER_TOKEN_BALANCES.replace("{userAddress}", userAddress).replace(
      "{contractAddresses}",
      quotedAddresses,
    );

    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling(url, "Failed to fetch user token balances");
  }

  /**
   * Fetch condition resolutions by condition IDs
   */
  async fetchConditionResolutions(conditionIds: string[]): Promise<ConditionResolutionRow[]> {
    if (conditionIds.length === 0) return [];

    const quotedIds = conditionIds.map((id) => `'${id}'`).join(",");
    const query = PM_SQL_QUERIES.CONDITION_RESOLUTIONS.replace("{conditionIds}", quotedIds);

    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<ConditionResolutionRow>(url, "Failed to fetch condition resolutions");
  }

  /**
   * Fetch single market detail
   */
  async fetchMarketDetail(marketId: string): Promise<MarketWithDetailsRow | null> {
    const query = PM_SQL_QUERIES.MARKET_DETAIL.replace("{marketId}", marketId);
    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<MarketWithDetailsRow>(url, "Failed to fetch market detail");
    return extractFirstOrNull(results);
  }
}

// Singleton instance using default config
let pmSqlApiInstance: PmSqlApi | null = null;

export function getPmSqlApi(): PmSqlApi {
  if (!pmSqlApiInstance) {
    pmSqlApiInstance = new PmSqlApi();
  }
  return pmSqlApiInstance;
}
