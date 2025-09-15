import { getCollectionByAddress } from "@/config";
import { trimAddress } from "@/lib/utils";
import { RealmMetadata } from "@/types";
import { fetchSQL, gameClientFetch } from "./apiClient";
import { QUERIES } from "./queries";

export interface ActiveMarketOrdersTotal {
  active_order_count: number;
  open_orders_total_wei: bigint | null; // SUM can return null if there are no rows
  floor_price_wei: bigint | null;
}

interface CollectionToken {
  token_id: number;
  order_id: number | null;
  name: string | null;
  symbol: string | null;
  metadata: RealmMetadata | null;
  best_price_hex: bigint | null;
  expiration: number | null;
  token_owner: string | null;
  order_owner: string | null;
  balance: string | null;
  contract_address: string;
  is_listed: boolean;
}

export interface SeasonPassRealm {
  token_id: string;
  balance: string;
  contract_address: string;
  season_pass_balance: string | null;
  metadata: RealmMetadata | null;
  account_address: string;
}

interface CollectionTrait {
  trait_type: string;
  trait_value: string;
}

/**
 * Fetch all unique traits for a collection efficiently without loading full token data
 */
export async function fetchCollectionTraits(contractAddress: string): Promise<Record<string, string[]>> {
  const query = QUERIES.COLLECTION_TRAITS.replace("{contractAddress}", contractAddress);
  const rawData = await fetchSQL<CollectionTrait[]>(query);

  const traitsMap: Record<string, Set<string>> = {};

  rawData.forEach(({ trait_type, trait_value }) => {
    const traitType = String(trait_type);
    const value = String(trait_value);

    if (!traitsMap[traitType]) {
      traitsMap[traitType] = new Set();
    }
    traitsMap[traitType].add(value);
  });

  // Convert sets to sorted arrays
  return Object.fromEntries(
    Object.entries(traitsMap).map(([key, valueSet]) => [
      key,
      Array.from(valueSet).sort((a, b) => {
        // Try numeric sort first
        const aNum = Number(a);
        const bNum = Number(b);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        // Fall back to string sort
        return a.localeCompare(b);
      }),
    ]),
  );
}

/**
 * Fetch totals for active market orders from the API
 */
export async function fetchCollectionStatistics(contractAddress: string): Promise<ActiveMarketOrdersTotal[]> {
  const collectionId = getCollectionByAddress(contractAddress)?.id;
  if (!collectionId) {
    throw new Error(`No collection found for address ${contractAddress}`);
  }
  const query = QUERIES.COLLECTION_STATISTICS.replaceAll("{collectionId}", collectionId.toString()).replaceAll(
    "{contractAddress}",
    contractAddress,
  );
  return await fetchSQL<ActiveMarketOrdersTotal[]>(query);
}

export interface FetchAllCollectionTokensOptions {
  ownerAddress?: string;
  limit?: number;
  offset?: number;
  traitFilters?: Record<string, string[]>;
  sortBy?: "price_asc" | "price_desc" | "token_id_asc" | "token_id_desc" | "listed_first";
  listedOnly?: boolean;
}

interface FetchAllCollectionTokensResult {
  tokens: CollectionToken[];
  totalCount: number;
}

/**
 * Fetch tokens in collection with enhanced filtering, sorting, and pagination
 */
export async function fetchAllCollectionTokens(
  contractAddress: string,
  options: FetchAllCollectionTokensOptions = {},
): Promise<FetchAllCollectionTokensResult> {
  const collectionId = getCollectionByAddress(contractAddress)?.id;
  if (!collectionId) {
    throw new Error(`No collection found for address ${contractAddress}`);
  }

  const { ownerAddress, limit, offset, traitFilters = {}, sortBy = "listed_first", listedOnly = false } = options;

  // Build trait filter clauses using simple JSON string matching
  let traitFilterClauses = "";
  const traitFilterKeys = Object.keys(traitFilters);
  if (traitFilterKeys.length > 0) {
    const clauses = traitFilterKeys
      .map((traitType) => {
        const values = traitFilters[traitType];
        if (values.length === 0) return "";

        // Match the complete attribute object to ensure trait_type and value are paired
        const valueConditions = values
          .map((value) => {
            const escapedTraitType = traitType.replace(/'/g, "''");
            const escapedValue = value.replace(/'/g, "''");

            // Match the pattern {"trait_type":"X","value":"Y"} to ensure they're in the same attribute
            return `t.metadata LIKE '%{"trait_type":"${escapedTraitType}","value":"${escapedValue}"}%'`;
          })
          .join(" OR ");

        return `(${valueConditions})`;
      })
      .filter((clause) => clause.length > 0);

    if (clauses.length > 0) {
      traitFilterClauses = `AND (${clauses.join(" AND ")})`;
    }
  }

  // Build listed only filter
  const listedOnlyClause = listedOnly ? "AND ao.order_id IS NOT NULL" : "";

  // Build order by clause
  let orderByClause = "";
  switch (sortBy) {
    case "price_asc":
      orderByClause = "ORDER BY is_listed DESC, price_sort_key ASC NULLS LAST, CAST(token_id AS INTEGER) ASC";
      break;
    case "price_desc":
      orderByClause = "ORDER BY is_listed DESC, price_sort_key DESC NULLS LAST, CAST(token_id AS INTEGER) ASC";
      break;
    case "token_id_asc":
      orderByClause = "ORDER BY CAST(token_id AS INTEGER) ASC";
      break;
    case "token_id_desc":
      orderByClause = "ORDER BY CAST(token_id AS INTEGER) DESC";
      break;
    case "listed_first":
    default:
      orderByClause =
        "ORDER BY is_listed DESC, CASE WHEN metadata IS NULL THEN 1 ELSE 0 END ASC, price_sort_key ASC NULLS LAST, CAST(token_id AS INTEGER) ASC";
      break;
  }

  // Build limit/offset clause
  const limitOffsetClause = limit !== undefined && offset !== undefined ? `LIMIT ${limit} OFFSET ${offset}` : "";

  // Build the main query
  const query = QUERIES.ALL_COLLECTION_TOKENS.replaceAll("{contractAddress}", contractAddress)
    .replace("{ownerAddress}", ownerAddress ?? "")
    .replace("{collectionId}", collectionId.toString())
    .replace("{traitFilters}", traitFilterClauses)
    .replace("{listedOnlyFilter}", listedOnlyClause)
    .replace("{orderByClause}", orderByClause)
    .replace("{limitOffsetClause}", limitOffsetClause);

  // Build the count query
  const countQuery = QUERIES.ALL_COLLECTION_TOKENS_COUNT.replaceAll("{contractAddress}", contractAddress)
    .replace("{ownerAddress}", ownerAddress ?? "")
    .replace("{collectionId}", collectionId.toString())
    .replace("{traitFilters}", traitFilterClauses)
    .replace("{listedOnlyFilter}", listedOnlyClause);

  // Execute both queries
  const [rawData, countData] = await Promise.all([
    fetchSQL<any[]>(query),
    fetchSQL<{ total_count: number }[]>(countQuery),
  ]);

  const tokens = rawData.map((item) => ({
    ...item,
    token_id: parseInt(item.token_id_hex ?? "0", 16),
    order_id: item.order_id ? parseInt(item.order_id, 16) : null,
    best_price_hex: item.price_hex ? BigInt(item.price_hex) : null,
    token_owner: item.token_owner ?? null,
    order_owner: item.order_owner ?? null,
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
    contract_address: contractAddress,
    is_listed: Boolean(item.is_listed),
  }));

  const totalCount = countData[0]?.total_count ?? 0;

  return { tokens, totalCount };
}

/**
 * Fetch a single collection token by ID from the API
 */
export async function fetchSingleCollectionToken(
  contractAddress: string,
  tokenId: number,
  collectionId: number,
): Promise<CollectionToken | null> {
  const query = QUERIES.SINGLE_COLLECTION_TOKEN.replaceAll("'{contractAddress}'", `'${contractAddress}'`)
    .replaceAll("{contractAddress}", contractAddress)
    .replaceAll("{tokenId}", tokenId.toString())
    .replaceAll("{collectionId}", collectionId.toString());

  const rawData = await fetchSQL<any[]>(query);

  if (rawData.length === 0) {
    return null;
  }

  const item = rawData[0];
  return {
    ...item,
    token_id: parseInt(item.token_id),
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
    best_price_hex: item.price_hex ? BigInt(item.price_hex) : null,
    is_listed: Boolean(item.is_listed),
  };
}

/**
 * Fetch season pass realms by address from the API
 */
export async function fetchSeasonPassRealmsByAddress(
  realmsAddress: string,
  seasonPassAddress: string,
  accountAddress: string,
): Promise<SeasonPassRealm[]> {
  const query = QUERIES.SEASON_PASS_REALMS_BY_ADDRESS.replace("{realmsAddress}", realmsAddress)
    .replace("{seasonPassAddress}", seasonPassAddress)
    .replace(/{accountAddress}/g, accountAddress);
  const rawData = await fetchSQL<any[]>(query);
  return rawData.map((item) => ({
    ...item,
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
  }));
}

interface TokenBalanceWithToken {
  token_id: string;
  balance: string;
  contract_address: string;
  account_address: string;
  name: string | null;
  symbol: string | null;
  expiration: number | null;
  best_price_hex: bigint | null;
  metadata: RealmMetadata | null;
}

// Raw type for data fetched by fetchTokenBalancesWithMetadata
interface RawTokenBalanceWithMetadata {
  token_id: string;
  balance: string;
  contract_address: string;
  token_owner: string; // This is account_address in the final type
  name?: string;
  symbol?: string;
  expiration?: number;
  best_price_hex?: string; // Raw hex string for bigint
  metadata?: string; // Raw JSON string
  order_id?: string;
}

interface ActiveMarketOrder {
  order_id: string;
  token_id: string;
  price: string;
  owner: string;
  expiration: number;
  collection_id: number;
}

export async function fetchActiveMarketOrders(
  contractAddress: string,
  tokenIds: string[],
): Promise<ActiveMarketOrder[]> {
  const collectionId = getCollectionByAddress(contractAddress)?.id;
  const query = QUERIES.ACTIVE_MARKET_ORDERS.replace("{collectionId}", collectionId?.toString() ?? "0").replace(
    "{tokenIds}",
    tokenIds.map((id) => `'${id}'`).join(","),
  );
  return await fetchSQL<ActiveMarketOrder[]>(query);
}

export async function fetchTokenBalancesWithMetadata(
  contractAddress: string,
  accountAddress: string,
): Promise<TokenBalanceWithToken[]> {
  const collectionId = getCollectionByAddress(contractAddress)?.id;
  if (!collectionId) {
    throw new Error(`No collection found for address ${contractAddress}`);
  }

  const query = QUERIES.TOKEN_BALANCES_WITH_METADATA.replaceAll("{contractAddress}", contractAddress)
    .replace("{collectionId}", collectionId.toString())
    .replace("{accountAddress}", accountAddress)
    .replace("{trimmedAccountAddress}", trimAddress(accountAddress));
  const rawData = await fetchSQL<RawTokenBalanceWithMetadata[]>(query);
  return rawData.map((item) => ({
    token_id: Number(item.token_id.split(":")[1]).toString(),
    balance: item.balance,
    contract_address: item.contract_address,
    account_address: item.token_owner,
    name: item.name ?? null,
    symbol: item.symbol ?? null,
    expiration: item.expiration ?? null,
    best_price_hex: item.best_price_hex ? BigInt(item.best_price_hex) : null,
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
    order_id: item.order_id ?? null,
  }));
}

interface MarketOrderEvent {
  event_id: string;
  state: string;
  token_id: string;
  price: string;
  owner: string;
  expiration: number;
  name: string | null;
  symbol: string | null;
  metadata: RealmMetadata | null;
  executed_at: string | null;
}

// Raw type for data fetched by fetchMarketOrderEvents
interface RawMarketOrderEvent {
  internal_event_id: string;
  executed_at?: string;
  state: string;
  token_id: string;
  price: string;
  owner: string;
  expiration: number;
  name?: string;
  symbol?: string;
  metadata?: string; // Raw JSON string
}

export async function fetchMarketOrderEvents(
  contractAddress: string,
  type: "sales" | "listings" | "all",
  limit?: number,
  offset?: number,
): Promise<MarketOrderEvent[]> {
  const finalType = type === "sales" ? "Accepted" : type;
  const collectionId = getCollectionByAddress(contractAddress)?.id ?? 1;

  const query = QUERIES.MARKET_ORDER_EVENTS.replaceAll("{contractAddress}", contractAddress)
    .replace("{collectionId}", collectionId?.toString())
    .replace("{limit}", limit?.toString() ?? "50")
    .replace("{offset}", offset?.toString() ?? "0")
    .replaceAll("{type}", finalType);
  const rawData = await fetchSQL<RawMarketOrderEvent[]>(query);
  return rawData.map((item) => ({
    event_id: item.internal_event_id,
    executed_at: item.executed_at ?? null,
    state: item.state,
    token_id: item.token_id,
    price: item.price,
    owner: item.owner,
    expiration: item.expiration,
    name: item.name ?? null,
    symbol: item.symbol ?? null,
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
  }));
}

export async function fetchDonkeyBurn(): Promise<number> {
  const rawData = await gameClientFetch<any[]>(QUERIES.DONKEY_BURN);
  return rawData.reduce((acc, donkey) => acc + Number(donkey.amount), 0);
}

export async function fetchTotalGuilds(): Promise<number> {
  const rawData = await gameClientFetch<any[]>(QUERIES.TOTAL_GUILDS);
  return rawData[0].total_guilds;
}

export async function fetchTotalStructures(): Promise<{ category: number; structure_count: number }[]> {
  const rawData = await gameClientFetch<any[]>(QUERIES.TOTAL_STRUCTURES);
  return rawData.map((item) => ({
    category: item.category,
    structure_count: item.structure_count,
  }));
}

export async function fetchTotalTroops(): Promise<{ category: number; tier: number; total_troops: number }[]> {
  const rawData = await gameClientFetch<any[]>(QUERIES.TOTAL_TROOPS);
  return rawData.map((item) => ({
    category: item.category,
    tier: item.tier,
    total_troops: item.total_troops,
  }));
}

export async function fetchTotalBattles(): Promise<number> {
  const rawData = await gameClientFetch<any[]>(QUERIES.TOTAL_BATTLES);
  return rawData[0].total_battles;
}

export async function fetchTotalAgents(): Promise<number> {
  const rawData = await gameClientFetch<any[]>(QUERIES.TOTAL_ALIVE_AGENTS);
  return rawData[0].total_agents;
}

export async function fetchTotalCreatedAgents(): Promise<number> {
  const rawData = await gameClientFetch<any[]>(QUERIES.TOTAL_CREATED_AGENTS);
  return rawData[0].total_agent_created_events;
}

export async function fetchTotalPlayers(): Promise<number> {
  const rawData = await gameClientFetch<any[]>(QUERIES.TOTAL_PLAYERS);
  return rawData[0].unique_wallets;
}

export async function fetchTotalTransactions(): Promise<number> {
  const rawData = await gameClientFetch<any[]>(QUERIES.TOTAL_TRANSACTIONS);
  return rawData[0].total_rows;
}

interface SeasonConfig {
  start_settling_at: number;
  start_main_at: number;
  end_at: number;
  end_grace_seconds: number;
  registration_grace_seconds: number;
}

interface SeasonDay {
  day: number;
  dayString: string;
}

/**
 * Fetch season config and calculate the current day since start_main_at
 */
export async function fetchSeasonDay(): Promise<SeasonDay> {
  const rawData = await gameClientFetch<SeasonConfig[]>(QUERIES.SEASON_CONFIG);
  console.log("rawData", rawData);

  if (!rawData || rawData.length === 0) {
    return {
      day: 0,
      dayString: "Day 0",
    };
  }

  const seasonConfig = rawData[0];
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const startMainAt = seasonConfig.start_main_at;

  // Calculate days since start_main_at
  const daysSinceStart = Math.floor((currentTime - startMainAt) / (24 * 60 * 60));

  // Ensure day is at least 1 if the game has started
  const currentDay = Math.max(currentTime >= startMainAt ? 1 : 0, daysSinceStart + 1);

  return {
    day: currentDay,
    dayString: `Day ${currentDay}`,
  };
}

interface CollectibleClaimed {
  token_address: string;
  attributes_raw: string;
  token_recipient: string;
  timestamp: number;
}

/**
 * Fetch collectible claimed events for a specific player
 */
// TODO: Uncomment this when the query is implemented
export async function fetchCollectibleClaimed(
  contractAddress: string,
  playerAddress: string,
  minTimestamp: number = 0,
): Promise<CollectibleClaimed[]> {
  // Convert Unix timestamp to ISO string format for SQL datetime comparison
  const formattedTimestamp = new Date(minTimestamp * 1000).toISOString().replace("T", " ").replace("Z", "");

  const query = QUERIES.COLLECTIBLE_CLAIMED.replace("{contractAddress}", contractAddress)
    .replace("{playerAddress}", playerAddress)
    .replace("{minTimestamp}", `'${formattedTimestamp}'`);

  return await gameClientFetch<CollectibleClaimed[]>(query);
}
