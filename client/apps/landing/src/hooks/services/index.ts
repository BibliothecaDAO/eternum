import { trimAddress } from "@/lib/utils";
import { RealmMetadata } from "@/types";
import { ContractAddress, HexPosition, ID } from "@bibliothecadao/types";
import { fetchSQL, gameClientFetch } from "./apiClient";
import { QUERIES } from "./queries";

export interface StructureLocation {
  "base.coord_x": number;
  "base.coord_y": number;
  owner: ContractAddress;
}

type DirectionString = "East" | "NorthEast" | "NorthWest" | "West" | "SouthWest" | "SouthEast";

export interface RealmVillageSlot {
  connected_realm_coord: HexPosition;
  connected_realm_entity_id: ID;
  connected_realm_id: ID;
  directions_left: Array<Partial<Record<DirectionString, []>>>;
}

export interface TokenTransfer {
  to_address: ContractAddress;
  contract_address: ContractAddress;
  token_id: string; // Assuming token_id might be large or non-numeric
  amount: string; // Assuming amount might be large
  executed_at: string; // ISO date string or similar
  from_address: ContractAddress;
  name: string;
  symbol: string;
}

export interface ActiveMarketOrdersTotal {
  active_order_count: number;
  open_orders_total_wei: bigint | null; // SUM can return null if there are no rows
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

export interface TokenBalance {
  token_id: string;
  balance: string;
  contract_address: string;
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
 * Fetch settlement structures from the API
 */
export async function fetchRealmSettlements(): Promise<StructureLocation[]> {
  return await fetchSQL<StructureLocation[]>(QUERIES.REALM_SETTLEMENTS);
}

// Raw type for data fetched by fetchRealmVillageSlots
interface RawRealmVillageSlot {
  "connected_realm_coord.x": number;
  "connected_realm_coord.y": number;
  connected_realm_entity_id: ID;
  connected_realm_id: ID;
  directions_left: string; // Raw JSON string
}

/**
 * Fetch village slots from the API
 */
export async function fetchRealmVillageSlots(): Promise<RealmVillageSlot[]> {
  const rawData = await fetchSQL<RawRealmVillageSlot[]>(QUERIES.REALM_VILLAGE_SLOTS);

  return rawData.map((item) => ({
    connected_realm_coord: { col: item["connected_realm_coord.x"], row: item["connected_realm_coord.y"] },
    connected_realm_entity_id: item.connected_realm_entity_id,
    connected_realm_id: item.connected_realm_id,
    directions_left: JSON.parse(item.directions_left || "[]"),
  }));
}

/**
 * Fetch token transfers for a specific contract and recipient from the API
 */
export async function fetchTokenTransfers(contractAddress: string, recipientAddress: string): Promise<TokenTransfer[]> {
  const query = QUERIES.TOKEN_TRANSFERS.replace("{contractAddress}", contractAddress).replace(
    "{recipientAddress}",
    recipientAddress,
  );
  return await fetchSQL<TokenTransfer[]>(query);
}

/**
 * Fetch totals for active market orders from the API
 */
export async function fetchActiveMarketOrdersTotal(contractAddress: string): Promise<ActiveMarketOrdersTotal[]> {
  const query = QUERIES.ACTIVE_MARKET_ORDERS_TOTAL.replaceAll("{contractAddress}", contractAddress);
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
  const query = QUERIES.OPEN_ORDERS_BY_PRICE.replaceAll("{contractAddress}", contractAddress)
    .replace("{limit}", limit?.toString() ?? "20")
    .replace("{offset}", offset?.toString() ?? "0")
    .replace("{ownerAddress}", ownerAddress ?? "");
  const rawData = await fetchSQL<any[]>(query);
  return rawData.map((item) => ({
    ...item,
    token_id: parseInt(item.token_id_hex ?? "0", 16),
    order_id: parseInt(item.order_id, 16),
    best_price_hex: item.price_hex ? BigInt(item.price_hex) : null,
    token_owner: item.token_owner ?? null,
    order_owner: item.order_owner ?? null,
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
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
  return await fetchSQL<SeasonPassRealm[]>(query);
}

export interface TokenBalanceWithToken {
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
}

export interface ActiveMarketOrder {
  order_id: string;
  token_id: string;
  price: string;
  owner: string;
  expiration: number;
  collection_id: number;
}

export async function fetchActiveMarketOrders(contractAddress: string, tokenId: string): Promise<ActiveMarketOrder[]> {
  const query = QUERIES.ACTIVE_MARKET_ORDERS.replace("{contractAddress}", contractAddress).replace(
    "{tokenId}",
    tokenId,
  );
  return await fetchSQL<ActiveMarketOrder[]>(query);
}

export async function fetchTokenBalancesWithMetadata(
  contractAddress: string,
  accountAddress: string,
): Promise<TokenBalanceWithToken[]> {
  const query = QUERIES.TOKEN_BALANCES_WITH_METADATA.replaceAll("{contractAddress}", contractAddress)
    .replace("{accountAddress}", accountAddress)
    .replace("{trimmedAccountAddress}", trimAddress(accountAddress));
  const rawData = await fetchSQL<RawTokenBalanceWithMetadata[]>(query);
  return rawData.map((item) => ({
    token_id: Number(item.token_id.split(":")[1]),
    balance: item.balance,
    contract_address: item.contract_address,
    account_address: item.token_owner,
    name: item.name ?? null,
    symbol: item.symbol ?? null,
    expiration: item.expiration ?? null,
    best_price_hex: item.best_price_hex ? BigInt(item.best_price_hex) : null,
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
  }));
}

export interface MarketOrderEvent {
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
  const query = QUERIES.MARKET_ORDER_EVENTS.replaceAll("{contractAddress}", contractAddress)
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
