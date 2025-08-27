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

export interface OpenOrderByPrice {
  token_id: number;
  order_id: number;
  name: string | null;
  symbol: string | null;
  metadata: RealmMetadata | null;
  best_price_hex: bigint | null;
  expiration: number | null;
  token_owner: string | null;
  order_owner: string | null;
  balance: string | null;
  contract_address: string;
}

// Raw type for data fetched by fetchOpenOrdersByPrice
interface RawOpenOrderByPrice {
  token_id_hex?: string;
  order_id: string; // Assuming it's a string from SQL that needs parsing
  price_hex?: string;
  token_owner?: string;
  order_owner?: string;
  metadata?: string; // Raw JSON string
  name?: string | null;
  symbol?: string | null;
  expiration?: number | null;
  balance?: string | null;
  // Any other fields spread by ...item that are part of OpenOrderByPrice
}

export interface SeasonPassRealm {
  token_id: string;
  balance: string;
  contract_address: string;
  season_pass_balance: string | null;
  metadata: RealmMetadata | null;
  account_address: string;
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

/**
 * Fetch open orders by price from the API
 */
export async function fetchOpenOrdersByPrice(
  contractAddress: string,
  ownerAddress?: string,
  limit?: number,
  offset?: number,
): Promise<OpenOrderByPrice[]> {
  const collectionId = getCollectionByAddress(contractAddress)?.id;
  if (!collectionId) {
    throw new Error(`No collection found for address ${contractAddress}`);
  }
  const query = QUERIES.OPEN_ORDERS_BY_PRICE.replaceAll("{contractAddress}", contractAddress)
    .replace("{limit}", limit?.toString() ?? "20")
    .replace("{offset}", offset?.toString() ?? "0")
    .replace("{ownerAddress}", ownerAddress ?? "")
    .replace("{collectionId}", collectionId.toString());
  const rawData = await fetchSQL<any[]>(query);
  return rawData.map((item) => ({
    ...item,
    token_id: parseInt(item.token_id_hex ?? "0", 16),
    order_id: parseInt(item.order_id, 16),
    best_price_hex: item.price_hex ? BigInt(item.price_hex) : null,
    token_owner: item.token_owner ?? null,
    order_owner: item.order_owner ?? null,
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
    contract_address: contractAddress,
  }));
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
