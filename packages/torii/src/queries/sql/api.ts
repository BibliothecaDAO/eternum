import { ContractAddress, GuardSlot, ID, ResourcesIds, TileDataInput, tileDataToTile } from "@bibliothecadao/types";

import {
  ArmyMapDataRaw,
  ExploredTileBounds,
  EventType,
  Guard,
  GuardData,
  Hyperstructure,
  PlayerLeaderboardRow,
  PlayerStructure,
  RawSettlementPlannerRealm,
  RawSettlementPlannerVillage,
  RawRealmVillageSlot,
  RealmVillageSlot,
  ResourceBalanceRow,
  SettlementPlannerSnapshot,
  SettlementPlannerTile,
  StoryEventData,
  StructureLocation,
  StructureMapDataRaw,
  SwapEventResponse,
  Tile,
  TradeEvent,
} from "../../types/sql";
import {
  buildApiUrl,
  extractFirstOrNull,
  fetchJsonWithErrorHandling,
  fetchWithErrorHandling,
  formatAddressForQuery,
  hexToBigInt,
  type SqlGameScope,
} from "../../utils/sql";
import { BATTLE_QUERIES } from "./battle";
import {
  addLeaderboardRanks,
  buildAdditionalLeaderboardEntries,
  buildRegisteredLeaderboardEntries,
  computeUnregisteredShareholderPoints,
  fetchLeaderboardSourceData,
  sanitizeLeaderboardPagination,
  sortLeaderboardEntries,
} from "./leaderboard-helpers";
import { RESOURCE_QUERIES } from "./resource";
import { STORY_QUERIES } from "./story";
import { STRUCTURE_QUERIES } from "./structure";
import { TILES_QUERIES } from "./tiles";
import { TRADING_QUERIES } from "./trading";

const DEFAULT_HYPERSTRUCTURE_RADIUS = 8;

type TileOptRow = {
  data: TileDataInput;
};

const parseDirectionSlots = (rawDirections: string | null | undefined): RealmVillageSlot["directions_left"] => {
  if (!rawDirections) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawDirections);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildCacheUrl = (baseUrl: string, path: string): URL => {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${trimmed}${normalizedPath}`);
};

// Short-lived dedupe + TTL for fetchStructuresByOwner. Pre-session entry callers
// mount concurrently and can query the same owner within a few hundred ms.
const STRUCTURES_BY_OWNER_TTL_MS = 500;
const structuresByOwnerCache = new Map<string, { promise: Promise<StructureLocation[]>; expiresAt: number }>();

export class SqlApi {
  constructor(
    private readonly baseUrl: string,
    private readonly cacheBaseUrl?: string,
    /** Pin every query to this world scope instead of the ambient one — for
     * per-world instances used by entry flows before bootstrap. */
    private readonly scope?: SqlGameScope,
  ) {}

  /**
   * Fetches all settlement structures from the SQL database.
   * SQL queries always return arrays.
   * @returns Promise resolving to an array of structure locations
   * @throws Error if API is not configured or request fails
   */
  async fetchRealmSettlements(): Promise<StructureLocation[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.REALM_SETTLEMENTS, this.scope);
    return await fetchWithErrorHandling<StructureLocation>(url, "Failed to fetch settlements");
  }

  /**
   * Fetch structures by owner from the SQL database.
   * SQL queries always return arrays.
   *
   * Concurrent calls for the same owner share a single in-flight request, and
   * repeats within {@link STRUCTURES_BY_OWNER_TTL_MS} reuse the resolved result.
   */
  async fetchStructuresByOwner(owner: string): Promise<StructureLocation[]> {
    const cacheKey = `${this.baseUrl}|${owner}`;
    const cached = structuresByOwnerCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise;
    }

    const formattedOwner = formatAddressForQuery(owner);
    const query = STRUCTURE_QUERIES.STRUCTURES_BY_OWNER.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    const promise = fetchWithErrorHandling<StructureLocation>(url, "Failed to fetch structures by owner");

    // Evict on rejection so the next caller retries instead of inheriting the error.
    promise.catch(() => {
      const current = structuresByOwnerCache.get(cacheKey);
      if (current?.promise === promise) {
        structuresByOwnerCache.delete(cacheKey);
      }
    });

    structuresByOwnerCache.set(cacheKey, {
      promise,
      expiresAt: Date.now() + STRUCTURES_BY_OWNER_TTL_MS,
    });

    return promise;
  }

  /**
   * Fetch village slots from the SQL database.
   * SQL queries always return arrays. We then transform the raw data.
   */
  async fetchRealmVillageSlots(): Promise<RealmVillageSlot[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.REALM_VILLAGE_SLOTS, this.scope);
    const rawData = await fetchWithErrorHandling<RawRealmVillageSlot>(url, "Failed to fetch village slots");
    return rawData.map((item) => ({
      connected_realm_coord: {
        col: item["connected_realm_coord.x"],
        row: item["connected_realm_coord.y"],
      },
      connected_realm_entity_id: item.connected_realm_entity_id,
      connected_realm_id: item.connected_realm_id,
      directions_left: parseDirectionSlots(item.directions_left),
    }));
  }

  async fetchSettlementPlannerSnapshot(): Promise<SettlementPlannerSnapshot> {
    const realmsUrl = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.SETTLEMENT_PLANNER_REALMS, this.scope);
    const villagesUrl = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.SETTLEMENT_PLANNER_VILLAGES, this.scope);

    const [rawRealms, rawVillages] = await Promise.all([
      fetchWithErrorHandling<RawSettlementPlannerRealm>(realmsUrl, "Failed to fetch settlement planner realms"),
      fetchWithErrorHandling<RawSettlementPlannerVillage>(villagesUrl, "Failed to fetch settlement planner villages"),
    ]);

    return {
      realms: rawRealms.map((realm) => ({
        entityId: realm.entity_id,
        realmId: realm.realm_id,
        ownerAddress: realm.owner_address,
        ownerName: realm.owner_name,
        coordX: realm.coord_x,
        coordY: realm.coord_y,
        villagesCount: Number(realm.villages_count ?? 0),
        directionsLeft: parseDirectionSlots(realm.directions_left),
      })),
      villages: rawVillages.map((village) => ({
        entityId: village.entity_id,
        coordX: village.coord_x,
        coordY: village.coord_y,
      })),
    };
  }

  async fetchExploredTilesInBounds(bounds: ExploredTileBounds): Promise<SettlementPlannerTile[]> {
    const query = TILES_QUERIES.TILES_IN_BOUNDS.replace("{minX}", bounds.minX.toString())
      .replace("{maxX}", bounds.maxX.toString())
      .replace("{minY}", bounds.minY.toString())
      .replace("{maxY}", bounds.maxY.toString());
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    const rows = await fetchWithErrorHandling<TileOptRow>(url, "Failed to fetch explored tiles in bounds");

    return rows
      .map((row) => tileDataToTile(row.data))
      .filter((tile) => !tile.alt && Number(tile.biome) !== 0)
      .map((tile) => ({
        coordX: tile.col,
        coordY: tile.row,
        biome: Number(tile.biome),
        alt: tile.alt,
      }));
  }

  /**
   * Fetch all tiles on the map from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchAllTiles(): Promise<Tile[]> {
    const cacheBase = this.cacheBaseUrl?.trim();
    if (cacheBase) {
      try {
        const cacheUrl = buildCacheUrl(cacheBase, "/api/cache/tiles");
        cacheUrl.searchParams.set("toriiSqlBaseUrl", this.baseUrl);
        const cachedRows = await fetchJsonWithErrorHandling<TileOptRow[]>(
          cacheUrl.toString(),
          "Failed to fetch cached tiles",
        );

        if (Array.isArray(cachedRows)) {
          return cachedRows.map((row) => tileDataToTile(row.data));
        }
      } catch (error) {
        console.warn("Cached tiles fetch failed; falling back to direct SQL.", error);
      }
    }

    const url = buildApiUrl(this.baseUrl, TILES_QUERIES.ALL_TILES, this.scope);
    const rows = await fetchWithErrorHandling<TileOptRow>(url, "Failed to fetch tiles");
    return rows.map((row) => tileDataToTile(row.data));
  }

  /**
   * Fetch all hyperstructures from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchHyperstructures(): Promise<Hyperstructure[]> {
    const cacheBase = this.cacheBaseUrl?.trim();
    if (cacheBase) {
      try {
        const cacheUrl = buildCacheUrl(cacheBase, "/api/cache/hyperstructures");
        cacheUrl.searchParams.set("toriiSqlBaseUrl", this.baseUrl);
        const cachedRows = await fetchJsonWithErrorHandling<Hyperstructure[]>(
          cacheUrl.toString(),
          "Failed to fetch cached hyperstructures",
        );

        if (Array.isArray(cachedRows)) {
          return cachedRows;
        }
      } catch (error) {
        console.warn("Cached hyperstructures fetch failed; falling back to direct SQL.", error);
      }
    }

    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.HYPERSTRUCTURES, this.scope);
    return await fetchWithErrorHandling<Hyperstructure>(url, "Failed to fetch hyperstructures");
  }

  /**
   * Fetch swap events from the SQL database and transform them into TradeEvents.
   * SQL queries always return arrays.
   */
  async fetchSwapEvents(userEntityIds: ID[]): Promise<TradeEvent[]> {
    const url = buildApiUrl(this.baseUrl, TRADING_QUERIES.SWAP_EVENTS, this.scope);
    const events = await fetchWithErrorHandling<SwapEventResponse>(url, "Failed to fetch swap events");

    const res = events.map((event) => {
      const isBuy = event.buy === 1;
      const lordsAmount = BigInt(event.lords_amount);
      const resourceAmount = BigInt(event.resource_amount);

      return {
        type: EventType.SWAP,
        event: {
          takerId: event.entity_id,
          makerId: 0, // For swap events, there's no maker
          makerAddress: "0x0",
          takerAddress: event.owner,
          isYours: userEntityIds.includes(event.entity_id),
          resourceGiven: {
            resourceId: isBuy ? ResourcesIds.Lords : event.resource_type,
            amount: Number(isBuy ? lordsAmount : resourceAmount),
          },
          resourceTaken: {
            resourceId: isBuy ? event.resource_type : ResourcesIds.Lords,
            amount: Number(isBuy ? resourceAmount : lordsAmount),
          },
          eventTime: new Date(Number(event.timestamp) * 1000),
        },
      };
    });
    return res;
  }

  /**
   * Fetch explorer address owner from the SQL database.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchExplorerAddressOwner(entityId: ID): Promise<ContractAddress | null> {
    const query = BATTLE_QUERIES.EXPLORER_ADDRESS_OWNER.replace("{entityId}", entityId.toString());
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    const results = await fetchWithErrorHandling<{ address_owner: ContractAddress }>(
      url,
      "Failed to fetch explorer address owner",
    );

    const firstResult = extractFirstOrNull(results);
    return firstResult?.address_owner ?? null;
  }

  /**
   * Fetch player structures with coordinates, category, and resources_packed from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchPlayerStructures(owner: string): Promise<PlayerStructure[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = STRUCTURE_QUERIES.PLAYER_STRUCTURES.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    return await fetchWithErrorHandling<PlayerStructure>(url, "Failed to fetch player structures");
  }

  /**
   * Fetch resource balances for a set of entity IDs from the s1_eternum-Resource table.
   * Selects only *_BALANCE columns (29 cols) instead of the full table (218 cols).
   * SQL queries always return arrays.
   */
  async fetchResourceBalances(entityIds: number[]): Promise<ResourceBalanceRow[]> {
    if (entityIds.length === 0) return [];
    const query = RESOURCE_QUERIES.RESOURCE_BALANCES.replace("{entityIds}", entityIds.join(","));
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    return await fetchWithErrorHandling<ResourceBalanceRow>(url, "Failed to fetch resource balances");
  }

  /**
   * Fetch guards by structure entity ID from the SQL database.
   * SQL queries always return arrays, so we extract the first result and transform it.
   */
  async fetchGuardsByStructure(entityId: ID): Promise<Guard[]> {
    const query = STRUCTURE_QUERIES.GUARDS_BY_STRUCTURE.replace("{entityId}", entityId.toString());
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    const results = await fetchWithErrorHandling<GuardData>(url, "Failed to fetch guards by structure");

    const guardData = extractFirstOrNull(results);
    if (!guardData) return [];

    // Transform the flat SQL result into structured Guard objects
    const guards: Guard[] = [
      {
        slot: GuardSlot.Delta,
        troops:
          guardData.delta_count && hexToBigInt(guardData.delta_count) > 0n
            ? {
                category: guardData.delta_category,
                tier: guardData.delta_tier,
                count: hexToBigInt(guardData.delta_count),
                stamina: {
                  amount: hexToBigInt(guardData.delta_stamina_amount),
                  updated_tick: hexToBigInt(guardData.delta_stamina_updated_tick),
                },
              }
            : null,
        destroyedTick: hexToBigInt(guardData.delta_destroyed_tick),
        cooldownEnd: 0, // Will be calculated by the client
      },
      {
        slot: GuardSlot.Charlie,
        troops:
          guardData.charlie_count && hexToBigInt(guardData.charlie_count) > 0n
            ? {
                category: guardData.charlie_category,
                tier: guardData.charlie_tier,
                count: hexToBigInt(guardData.charlie_count),
                stamina: {
                  amount: hexToBigInt(guardData.charlie_stamina_amount),
                  updated_tick: hexToBigInt(guardData.charlie_stamina_updated_tick),
                },
              }
            : null,
        destroyedTick: hexToBigInt(guardData.charlie_destroyed_tick),
        cooldownEnd: 0, // Will be calculated by the client
      },
      {
        slot: GuardSlot.Bravo,
        troops:
          guardData.bravo_count && hexToBigInt(guardData.bravo_count) > 0n
            ? {
                category: guardData.bravo_category,
                tier: guardData.bravo_tier,
                count: hexToBigInt(guardData.bravo_count),
                stamina: {
                  amount: hexToBigInt(guardData.bravo_stamina_amount),
                  updated_tick: hexToBigInt(guardData.bravo_stamina_updated_tick),
                },
              }
            : null,
        destroyedTick: hexToBigInt(guardData.bravo_destroyed_tick),
        cooldownEnd: 0, // Will be calculated by the client
      },
      {
        slot: GuardSlot.Alpha,
        troops:
          guardData.alpha_count && hexToBigInt(guardData.alpha_count) > 0n
            ? {
                category: guardData.alpha_category,
                tier: guardData.alpha_tier,
                count: hexToBigInt(guardData.alpha_count),
                stamina: {
                  amount: hexToBigInt(guardData.alpha_stamina_amount),
                  updated_tick: hexToBigInt(guardData.alpha_stamina_updated_tick),
                },
              }
            : null,
        destroyedTick: hexToBigInt(guardData.alpha_destroyed_tick),
        cooldownEnd: 0, // Will be calculated by the client
      },
    ];

    return guards;
  }

  /**
   * Fetch all structures for map display from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchAllStructuresMapData(): Promise<StructureMapDataRaw[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.ALL_STRUCTURES_MAP_DATA, this.scope);
    return await fetchWithErrorHandling<StructureMapDataRaw>(url, "Failed to fetch all structures map data");
  }

  /**
   * Fetch all armies for map display from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchAllArmiesMapData(): Promise<ArmyMapDataRaw[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.ALL_ARMIES_MAP_DATA, this.scope);
    return await fetchWithErrorHandling<ArmyMapDataRaw>(url, "Failed to fetch all armies map data");
  }

  /**
   * Fetch the world contract address from the SQL database.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchWorldAddress(): Promise<ContractAddress | null> {
    const query = `SELECT contract_address FROM contracts WHERE contract_type = 'WORLD'`;
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    const results = await fetchWithErrorHandling<{ contract_address: ContractAddress }>(
      url,
      "Failed to fetch world address",
    );

    const firstResult = extractFirstOrNull(results);
    return firstResult?.contract_address ?? null;
  }

  /**
   * Fetches story events with pagination support.
   * SQL queries always return arrays.
   */
  async fetchStoryEvents(limit: number = 50, offset: number = 0): Promise<StoryEventData[]> {
    const cacheBase = this.cacheBaseUrl?.trim();
    if (cacheBase) {
      try {
        const cacheUrl = buildCacheUrl(cacheBase, "/api/cache/story-events");
        cacheUrl.searchParams.set("limit", limit.toString());
        cacheUrl.searchParams.set("offset", offset.toString());
        cacheUrl.searchParams.set("toriiSqlBaseUrl", this.baseUrl);
        return await fetchJsonWithErrorHandling<StoryEventData[]>(
          cacheUrl.toString(),
          "Failed to fetch cached story events",
        );
      } catch (error) {
        console.warn("Cached story events fetch failed; falling back to direct SQL.", error);
      }
    }

    const query = STORY_QUERIES.ALL_STORY_EVENTS.replace("{limit}", limit.toString()).replace(
      "{offset}",
      offset.toString(),
    );
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    return await fetchWithErrorHandling<StoryEventData>(url, "Failed to fetch story events");
  }

  /**
   * Fetches story events by entity ID with pagination.
   * SQL queries always return arrays.
   */
  async fetchStoryEventsByEntity(entityId: ID, limit: number = 50, offset: number = 0): Promise<StoryEventData[]> {
    const query = STORY_QUERIES.STORY_EVENTS_BY_ENTITY.replace("{entityId}", entityId.toString())
      .replace("{limit}", limit.toString())
      .replace("{offset}", offset.toString());
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    return await fetchWithErrorHandling<StoryEventData>(url, "Failed to fetch story events by entity");
  }

  /**
   * Fetches story events by owner address with pagination.
   * SQL queries always return arrays.
   */
  async fetchStoryEventsByOwner(owner: string, limit: number = 50, offset: number = 0): Promise<StoryEventData[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = STORY_QUERIES.STORY_EVENTS_BY_OWNER.replace("{owner}", formattedOwner)
      .replace("{limit}", limit.toString())
      .replace("{offset}", offset.toString());
    const url = buildApiUrl(this.baseUrl, query, this.scope);
    return await fetchWithErrorHandling<StoryEventData>(url, "Failed to fetch story events by owner");
  }

  /**
   * Counts total number of story events for pagination.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchStoryEventsCount(): Promise<number> {
    const url = buildApiUrl(this.baseUrl, STORY_QUERIES.STORY_EVENTS_COUNT, this.scope);
    const results = await fetchWithErrorHandling<{ total_count: number }>(url, "Failed to count story events");
    const firstResult = extractFirstOrNull(results);
    return firstResult?.total_count ?? 0;
  }

  /**
   * Fetches player leaderboard data with unregistered shareholder points aggregated server-side.
   */
  async fetchPlayerLeaderboard(limit: number = 10, offset: number = 0): Promise<PlayerLeaderboardRow[]> {
    const { safeLimit, safeOffset, effectiveLimit } = sanitizeLeaderboardPagination(limit, offset);

    if (safeLimit === 0) {
      return [];
    }

    const { registeredRows, hyperstructureShareholderRows, hyperstructureRows, hyperstructureConfigRow } =
      await fetchLeaderboardSourceData({
        baseUrl: this.baseUrl,
        cacheBaseUrl: this.cacheBaseUrl,
        effectiveLimit,
        defaultHyperstructureRadius: DEFAULT_HYPERSTRUCTURE_RADIUS,
        scope: this.scope,
      });

    const unregisteredShareholderPoints = computeUnregisteredShareholderPoints({
      configRow: hyperstructureConfigRow,
      hyperstructureRows,
      hyperstructureShareholderRows,
    });

    const { entries: registeredEntries, processedAddresses } = buildRegisteredLeaderboardEntries({
      registeredRows,
      unregisteredShareholderPoints,
    });

    const additionalEntries = buildAdditionalLeaderboardEntries({
      unregisteredShareholderPoints,
      processedAddresses,
    });

    const sortedEntries = sortLeaderboardEntries([...registeredEntries, ...additionalEntries]);
    const rankedEntries = addLeaderboardRanks(sortedEntries);

    return rankedEntries.slice(safeOffset, safeOffset + safeLimit);
  }

  /**
   * Fetches leaderboard data for a single player by address, including unregistered shareholder points.
   */
  async fetchPlayerLeaderboardByAddress(playerAddress: string): Promise<PlayerLeaderboardRow | null> {
    const trimmed = playerAddress.trim().toLowerCase();
    if (!trimmed) {
      return null;
    }

    const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    if (!/^0x[0-9a-f]+$/.test(prefixed)) {
      return null;
    }

    let canonicalAddress: string;
    try {
      canonicalAddress = formatAddressForQuery(prefixed).toLowerCase();
    } catch {
      return null;
    }

    const leaderboardSourceData = await fetchLeaderboardSourceData({
      baseUrl: this.baseUrl,
      cacheBaseUrl: this.cacheBaseUrl,
      effectiveLimit: 0,
      defaultHyperstructureRadius: DEFAULT_HYPERSTRUCTURE_RADIUS,
      scope: this.scope,
    });

    const unregisteredShareholderPoints = computeUnregisteredShareholderPoints({
      configRow: leaderboardSourceData.hyperstructureConfigRow,
      hyperstructureRows: leaderboardSourceData.hyperstructureRows,
      hyperstructureShareholderRows: leaderboardSourceData.hyperstructureShareholderRows,
    });

    const { entries: registeredEntries, processedAddresses } = buildRegisteredLeaderboardEntries({
      registeredRows: leaderboardSourceData.registeredRows,
      unregisteredShareholderPoints,
    });

    const additionalEntries = buildAdditionalLeaderboardEntries({
      unregisteredShareholderPoints,
      processedAddresses,
    });

    const rankedEntries = addLeaderboardRanks(sortLeaderboardEntries([...registeredEntries, ...additionalEntries]));

    const candidateAddresses = new Set<string>();
    const pushCandidate = (value: string | null | undefined) => {
      if (typeof value !== "string") {
        return;
      }

      const normalized = value.trim().toLowerCase();
      if (normalized) {
        candidateAddresses.add(normalized);
      }
    };

    pushCandidate(canonicalAddress);
    pushCandidate(prefixed);

    try {
      pushCandidate(`0x${BigInt(prefixed).toString(16)}`);
    } catch {
      // ignore invalid conversions
    }

    try {
      pushCandidate(`0x${BigInt(canonicalAddress).toString(16)}`);
    } catch {
      // ignore invalid conversions
    }

    const match = rankedEntries.find((entry) => {
      const entryCandidates = [typeof entry.playerAddress === "string" ? entry.playerAddress.toLowerCase() : null];

      return entryCandidates.some((value) => value !== null && candidateAddresses.has(value));
    });

    return match ?? null;
  }
}
