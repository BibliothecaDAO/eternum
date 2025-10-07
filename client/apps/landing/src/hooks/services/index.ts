import { getCollectionByAddress } from "@/config";
import { trimAddress } from "@/lib/utils";
import { RealmMetadata } from "@/types";
import { calculateUnregisteredShareholderPointsCache, type ContractAddressAndAmount } from "@/utils/leaderboard";
import type { ContractAddress } from "@bibliothecadao/types";
import { fetchSQL, gameClientFetch } from "./apiClient";
import { QUERIES } from "./queries";

const DEFAULT_HYPERSTRUCTURE_RADIUS = 8;

const LEGACY_TRAIT_KEY_COLLECTIONS = new Set<string>([
  "0x36017e69d21d6d8c13e266eabb73ef1f1d02722d86bdcabe5f168f8e549d3cd",
]);

const MOCK_COLLECTION_STATISTICS: Record<string, ActiveMarketOrdersTotal[]> = {
  default: [
    {
      active_order_count: 3,
      floor_price_wei: BigInt("27500000000000000000000"),
      open_orders_total_wei: BigInt("734100000000000000000000"),
    },
    {
      active_order_count: 8,
      floor_price_wei: BigInt("900000000000000000000"),
      open_orders_total_wei: BigInt("179894000000000000000000"),
    },
    {
      active_order_count: 97,
      floor_price_wei: BigInt("39000000000000000000"),
      open_orders_total_wei: BigInt("37620000000000000000000"),
    },
    {
      active_order_count: 16,
      floor_price_wei: BigInt("18000000000000000000000"),
      open_orders_total_wei: BigInt("317298000000000000000000"),
    },
    {
      active_order_count: 394,
      floor_price_wei: BigInt("50000000000000000000"),
      open_orders_total_wei: BigInt("255025000000000000000000"),
    },
    {
      active_order_count: 34,
      floor_price_wei: BigInt("99000000000000000000"),
      open_orders_total_wei: BigInt("7339000000000000000000"),
    },
  ],
};

export interface ActiveMarketOrdersTotal {
  active_order_count: number;
  open_orders_total_wei: bigint | null; // SUM can return null if there are no rows
  floor_price_wei: bigint | null;
}

interface CollectionToken {
  token_id: string;
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
  token_id_hex?: string | null;
  token_id_decimal?: string | null;
}

export interface SeasonPassRealm {
  token_id: string;
  balance: string;
  contract_address: string;
  season_pass_balance: string | null;
  metadata: RealmMetadata | null;
  account_address: string;
}

interface PlayerLeaderboardRow {
  player_address: string | null;
  player_name: string | null;
  prize_claimed: number | null;
  registered_points: number | string | null;
}

interface PlayerLeaderboardEntry {
  playerAddress: string;
  playerName: string | null;
  prizeClaimed: boolean;
  registeredPointsRaw: number;
  registeredPoints: number;
}

interface HyperstructureLeaderboardConfigRow {
  points_per_second: string | number | bigint | null;
  season_end: string | number | bigint | null;
  realm_count: string | number | bigint | null;
}

interface HyperstructureShareholderRow {
  hyperstructure_id: number | string | bigint | null;
  start_at: number | string | bigint | null;
  shareholders: unknown;
}

interface HyperstructureShareholder {
  hyperstructure_id: number;
  start_at: number;
  shareholders: ContractAddressAndAmount[];
}

interface HyperstructureRealmCountRow {
  hyperstructure_entity_id: number | string | bigint | null;
  hyperstructure_coord_x: number | string | bigint | null;
  hyperstructure_coord_y: number | string | bigint | null;
  realm_count_within_radius: number | string | bigint | null;
}

interface HyperstructureRow {
  hyperstructure_id: number | string | bigint | null;
  points_multiplier: number | string | bigint | null;
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

export interface FetchCollectionStatisticsOptions {
  useMockup?: boolean;
}

/**
 * Fetch totals for active market orders from the API
 */
export async function fetchCollectionStatistics(
  contractAddress: string,
  options: FetchCollectionStatisticsOptions = {},
): Promise<ActiveMarketOrdersTotal[]> {
  if (options.useMockup) {
    const mockKey = trimAddress(contractAddress)?.toLowerCase();
    if (mockKey && MOCK_COLLECTION_STATISTICS[mockKey]) {
      return MOCK_COLLECTION_STATISTICS[mockKey];
    }
    return MOCK_COLLECTION_STATISTICS.default ?? [];
  }

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

const REGISTERED_POINTS_PRECISION = 1_000_000;

export async function fetchPlayerLeaderboard(
  limit: number = 10,
  offset: number = 0,
): Promise<PlayerLeaderboardEntry[]> {
  const safeLimit = Math.max(0, limit);
  const safeOffset = Math.max(0, offset);

  if (safeLimit === 0) {
    return [];
  }

  const effectiveLimit = safeLimit + safeOffset;

  const leaderboardQuery = QUERIES.PLAYER_LEADERBOARD.replace("{limit}", effectiveLimit.toString()).replace(
    "{offset}",
    "0",
  );

  const [rows, hyperstructureShareholderRows, hyperstructureRows, hyperstructureConfigRows, hyperstructureRealmCounts] =
    await Promise.all([
      gameClientFetch<PlayerLeaderboardRow[]>(leaderboardQuery),
      gameClientFetch<HyperstructureShareholderRow[]>(QUERIES.HYPERSTRUCTURE_SHAREHOLDERS),
      gameClientFetch<HyperstructureRow[]>(QUERIES.HYPERSTRUCTURES_WITH_MULTIPLIER),
      gameClientFetch<HyperstructureLeaderboardConfigRow[]>(QUERIES.HYPERSTRUCTURE_LEADERBOARD_CONFIG),
      gameClientFetch<HyperstructureRealmCountRow[]>(
        QUERIES.HYPERSTRUCTURES_WITH_REALM_COUNT.replaceAll("{radius}", DEFAULT_HYPERSTRUCTURE_RADIUS.toString()),
      ),
    ]);

  type NumericLike = string | number | bigint | null | undefined;

  const parseNumericValue = (value: NumericLike): number => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed.length) {
        return 0;
      }

      try {
        if (/^0x[0-9a-f]+$/i.test(trimmed)) {
          return Number(BigInt(trimmed));
        }

        const numeric = Number(trimmed);
        return Number.isFinite(numeric) ? numeric : 0;
      } catch {
        return 0;
      }
    }

    return 0;
  };

  const parseBigInt = (value: NumericLike): bigint => {
    if (typeof value === "bigint") {
      return value;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return 0n;
      }
      return BigInt(Math.trunc(value));
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed.length) {
        return 0n;
      }

      try {
        return trimmed.startsWith("0x") || trimmed.startsWith("0X") ? BigInt(trimmed) : BigInt(trimmed);
      } catch {
        return 0n;
      }
    }

    return 0n;
  };

  const normalizeAddress = (value: unknown): ContractAddress | null => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed.length) {
      return null;
    }

    const lower = trimmed.toLowerCase();
    const prefixed = lower.startsWith("0x") ? lower : `0x${lower}`;
    return prefixed as unknown as ContractAddress;
  };

  const unwrapValue = (input: unknown): unknown => {
    if (input && typeof input === "object") {
      const record = input as Record<string, unknown>;
      if ("value" in record) {
        return unwrapValue(record.value);
      }
      if ("inner" in record) {
        return unwrapValue(record.inner);
      }
    }
    return input;
  };

  const parseShareholders = (raw: unknown): ContractAddressAndAmount[] => {
    if (raw === null || raw === undefined) {
      return [];
    }

    let candidate: unknown = raw;

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed.length) {
        return [];
      }

      try {
        candidate = JSON.parse(trimmed);
      } catch {
        const normalised = trimmed.replace(/\(/g, "[").replace(/\)/g, "]");
        try {
          candidate = JSON.parse(normalised);
        } catch {
          return [];
        }
      }
    }

    if (!Array.isArray(candidate)) {
      return [];
    }

    const shareholders: ContractAddressAndAmount[] = [];

    for (const entry of candidate) {
      if (!entry) {
        continue;
      }

      let addressValue: unknown;
      let percentageValue: unknown;

      if (Array.isArray(entry)) {
        [addressValue, percentageValue] = entry;
      } else if (typeof entry === "object") {
        const record = entry as Record<string, unknown>;

        if (Array.isArray(record.value)) {
          [addressValue, percentageValue] = record.value;
        } else {
          addressValue = record.address ?? record["0"];
          percentageValue = record.percentage ?? record["1"];
        }
      }

      addressValue = unwrapValue(addressValue);
      percentageValue = unwrapValue(percentageValue);

      const address = normalizeAddress(addressValue);
      if (!address) {
        continue;
      }

      const numeric = parseNumericValue(percentageValue as NumericLike);
      if (numeric <= 0) {
        continue;
      }

      let percentage = numeric;
      if (percentage > 1) {
        if (percentage > 1000) {
          percentage = percentage / 10_000;
        } else if (percentage > 100) {
          percentage = percentage / 10_000;
        } else {
          percentage = percentage / 100;
        }
      }

      if (percentage <= 0) {
        continue;
      }

      if (percentage > 1) {
        percentage = 1;
      }

      shareholders.push({
        address,
        percentage,
      });
    }

    return shareholders;
  };

  const configRow = hyperstructureConfigRows[0];
  const rawPointsPerSecond = parseBigInt(configRow?.points_per_second);
  const pointsPerSecondWithoutMultiplier =
    rawPointsPerSecond > 0n ? Number(rawPointsPerSecond) / REGISTERED_POINTS_PRECISION : 0;
  const seasonEnd = parseNumericValue(configRow?.season_end);
  const realmCount = Math.max(0, Math.floor(parseNumericValue(configRow?.realm_count)));

  const hyperstructureRealmCountsById = new Map<number, number>(
    hyperstructureRealmCounts
      .map((row) => {
        const hyperstructureId = Math.floor(parseNumericValue(row.hyperstructure_entity_id));
        if (!Number.isFinite(hyperstructureId) || hyperstructureId <= 0) {
          return null;
        }

        const realmCount = Math.max(0, Math.floor(parseNumericValue(row.realm_count_within_radius)));
        return [hyperstructureId, realmCount] as const;
      })
      .filter((entry): entry is readonly [number, number] => entry !== null),
  );

  const hyperstructures = hyperstructureRows
    .map((row) => {
      const hyperstructureId = Math.floor(parseNumericValue(row.hyperstructure_id));
      if (!Number.isFinite(hyperstructureId) || hyperstructureId <= 0) {
        return null;
      }

      const pointsMultiplierRaw = parseNumericValue(row.points_multiplier);
      const pointsMultiplier = pointsMultiplierRaw > 0 ? pointsMultiplierRaw : 1;
      const realmCount = hyperstructureRealmCountsById.get(hyperstructureId) ?? 0;

      return {
        hyperstructure_id: hyperstructureId,
        points_multiplier: pointsMultiplier,
        realm_count: realmCount,
      };
    })
    .filter(
      (item): item is { hyperstructure_id: number; points_multiplier: number; realm_count: number } => item !== null,
    );

  const realmCountPerHyperstructures =
    hyperstructures.length > 0
      ? new Map(hyperstructures.map((item) => [item.hyperstructure_id, item.realm_count] as const))
      : undefined;

  const hyperstructureShareholders = hyperstructureShareholderRows
    .map((row) => {
      const hyperstructureId = Math.floor(parseNumericValue(row.hyperstructure_id));
      if (!Number.isFinite(hyperstructureId) || hyperstructureId <= 0) {
        return null;
      }

      const startAt = Math.floor(parseNumericValue(row.start_at));
      if (startAt <= 0) {
        return null;
      }

      const shareholders = parseShareholders(row.shareholders);
      if (shareholders.length === 0) {
        return null;
      }

      return {
        hyperstructure_id: hyperstructureId,
        start_at: startAt,
        shareholders,
      };
    })
    .filter((item): item is HyperstructureShareholder => item !== null);

  const hasHyperstructureData =
    pointsPerSecondWithoutMultiplier > 0 && hyperstructureShareholders.length > 0 && hyperstructures.length > 0;

  let unregisteredShareholderPoints = new Map<string, number>();
  if (hasHyperstructureData) {
    const computed = calculateUnregisteredShareholderPointsCache({
      pointsPerSecondWithoutMultiplier,
      realmCountPerHyperstructures,
      seasonEnd,
      hyperstructureShareholders,
      hyperstructures,
    });

    unregisteredShareholderPoints = new Map(
      Array.from(computed.entries()).map(([address, points]) => [String(address).toLowerCase(), points]),
    );
  }

  const processedAddresses = new Set<string>();
  const precision = REGISTERED_POINTS_PRECISION;

  const entriesFromRows = rows
    .map((row) => {
      const rawPointsValue =
        typeof row.registered_points === "number" ? row.registered_points : Number(row.registered_points ?? 0);

      const safeRawPoints = Number.isFinite(rawPointsValue) ? rawPointsValue : 0;

      let decodedPlayerName = row.player_name?.trim() || null;
      if (decodedPlayerName && decodedPlayerName.startsWith("0x")) {
        try {
          const hexString = decodedPlayerName.slice(2);
          let ascii = "";
          for (let i = 0; i < hexString.length; i += 2) {
            const hexByte = hexString.slice(i, i + 2);
            const charCode = parseInt(hexByte, 16);
            if (Number.isInteger(charCode) && charCode > 0 && charCode < 127) {
              ascii += String.fromCharCode(charCode);
            }
          }
          if (ascii.length > 0) {
            decodedPlayerName = ascii;
          }
        } catch (error) {
          console.warn("Failed to decode player name:", decodedPlayerName);
        }
      }

      const playerAddress = row.player_address ?? "";
      if (!playerAddress.length) {
        return null;
      }

      const normalizedAddress = playerAddress.toLowerCase();
      processedAddresses.add(normalizedAddress);

      const baseRaw = safeRawPoints;
      const bonusPoints = unregisteredShareholderPoints.get(normalizedAddress) ?? 0;
      const bonusRaw = Math.round(bonusPoints * precision);
      const totalRaw = baseRaw + bonusRaw;
      const totalPoints = totalRaw / precision;

      return {
        playerAddress,
        playerName: decodedPlayerName,
        prizeClaimed: Boolean(row.prize_claimed),
        registeredPointsRaw: totalRaw,
        registeredPoints: totalPoints,
      } as PlayerLeaderboardEntry;
    })
    .filter((entry): entry is PlayerLeaderboardEntry => Boolean(entry));

  const additionalEntries: PlayerLeaderboardEntry[] = [];

  for (const [address, points] of unregisteredShareholderPoints) {
    if (processedAddresses.has(address) || points <= 0) {
      continue;
    }

    const normalizedAddress = String(address).toLowerCase();

    const bonusRaw = Math.round(points * precision);
    additionalEntries.push({
      playerAddress: normalizedAddress,
      playerName: null,
      prizeClaimed: false,
      registeredPointsRaw: bonusRaw,
      registeredPoints: bonusRaw / precision,
    });
  }

  const combinedEntries = [...entriesFromRows, ...additionalEntries].sort(
    (a, b) => b.registeredPoints - a.registeredPoints,
  );

  return combinedEntries.slice(safeOffset, safeOffset + safeLimit);
}

/**
 * Fetch a single collection token by ID from the API
 */
export async function fetchSingleCollectionToken(
  contractAddress: string,
  tokenId: string,
  collectionId: number,
): Promise<CollectionToken | null> {
  const tokenIdBigInt = tokenId.startsWith("0x") ? BigInt(tokenId) : BigInt(tokenId);
  const tokenIdDecimal = tokenIdBigInt.toString();

  const query = QUERIES.SINGLE_COLLECTION_TOKEN.replaceAll("'{contractAddress}'", `'${contractAddress}'`)
    .replaceAll("{contractAddress}", contractAddress)
    .replaceAll("{tokenId}", tokenIdDecimal)
    .replaceAll("{collectionId}", collectionId.toString());

  const rawData = await fetchSQL<any[]>(query);

  if (rawData.length === 0) {
    return null;
  }

  const item = rawData[0];
  const tokenIdHex = item.token_id_hex ?? (item.token_id ? `0x${item.token_id}` : null);
  const tokenIdDecimalResult = tokenIdHex ? BigInt(tokenIdHex).toString() : (item.token_id ?? tokenIdDecimal);

  return {
    ...item,
    token_id: tokenIdDecimalResult,
    token_id_hex: tokenIdHex,
    token_id_decimal: tokenIdDecimalResult,
    metadata: normalizeMetadata(item.metadata),
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
    metadata: normalizeMetadata(item.metadata),
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
  metadata?: string | RealmMetadata; // Raw JSON string or parsed object
  order_id?: string;
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
    metadata: normalizeMetadata(item.metadata),
    order_id: item.order_id ?? null,
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
function normalizeMetadata(rawMetadata: string | RealmMetadata | null | undefined): RealmMetadata | null {
  if (!rawMetadata) return null;

  try {
    const metadataObj = typeof rawMetadata === "string" ? JSON.parse(rawMetadata) : rawMetadata;
    if (metadataObj && Array.isArray(metadataObj.attributes)) {
      metadataObj.attributes = metadataObj.attributes.map((attribute: any) => {
        if (attribute && attribute.trait && !attribute.trait_type) {
          return { ...attribute, trait_type: attribute.trait };
        }
        return attribute;
      });
    }
    return metadataObj;
  } catch (error) {
    console.warn("Failed to parse metadata", error);
    return null;
  }
}
