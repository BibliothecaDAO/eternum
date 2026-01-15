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

interface MarketCountRow {
  total: string; // SQL returns string
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
}

// Singleton instance using default config
let pmSqlApiInstance: PmSqlApi | null = null;

export function getPmSqlApi(): PmSqlApi {
  if (!pmSqlApiInstance) {
    pmSqlApiInstance = new PmSqlApi();
  }
  return pmSqlApiInstance;
}
