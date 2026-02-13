import { RESOURCE_BALANCE_COLUMNS } from "@bibliothecadao/torii";
import { ViewCache } from "../cache";
import { computeStrength } from "../compute";
import type { ClientLogger } from "../config";
import type {
  ID,
  ContractAddress,
  GuardState,
  ExplorerSummary,
  MapStructure,
  MapArmy,
  TileState,
  LeaderboardEntry,
  PlayerStructureSummary,
  PlayerArmySummary,
  SwapEvent,
  GameEvent,
} from "../types/common";
import type {
  RealmView,
  ExplorerView,
  MapAreaView,
  MarketView,
  PlayerView,
  HyperstructureView,
  LeaderboardView,
  BankView,
  EventsView,
} from "../types/views";

/**
 * Minimal SqlApi interface describing only the methods ViewClient actually calls.
 * Using a structural type avoids importing the concrete SqlApi class and keeps
 * the package decoupled.
 */
export interface SqlApiLike {
  fetchPlayerStructures(owner: string): Promise<any[]>;
  fetchResourceBalances(entityIds: number[]): Promise<any[]>;
  fetchGuardsByStructure(entityId: ID): Promise<any[]>;
  fetchAllArmiesMapData(): Promise<any[]>;
  fetchAllStructuresMapData(): Promise<any[]>;
  fetchAllTiles(): Promise<any[]>;
  fetchBattleLogs(afterTimestamp?: string): Promise<any[]>;
  fetchHyperstructures(): Promise<any[]>;
  fetchSwapEvents(userEntityIds: ID[]): Promise<any[]>;
  fetchPlayerLeaderboard(limit?: number, offset?: number): Promise<any[]>;
  fetchPlayerLeaderboardByAddress?(address: string): Promise<any | null>;
  fetchStoryEvents(limit?: number, offset?: number): Promise<any[]>;
  fetchStoryEventsByEntity(entityId: ID, limit?: number, offset?: number): Promise<any[]>;
  fetchStoryEventsByOwner(owner: string, limit?: number, offset?: number): Promise<any[]>;
  fetchStoryEventsCount(): Promise<number>;
  fetchStructuresByOwner(owner: string): Promise<any[]>;
  fetchExplorerAddressOwner(entityId: ID): Promise<string | null>;
}

/**
 * ViewClient provides high-level, cached read methods for Eternum game state.
 *
 * Each view method follows the same pattern:
 *   1. Check cache for an existing, non-expired entry.
 *   2. On cache miss, query SqlApi for raw data.
 *   3. Transform the raw response into the corresponding view type.
 *   4. Store the result in cache.
 *   5. Return the typed view.
 */
export class ViewClient {
  constructor(
    private sql: SqlApiLike,
    private cache: ViewCache,
    private getAccount: () => ContractAddress | null,
    private currentTimestamp: () => number,
    private logger: ClientLogger = console,
  ) {}

  // ---------------------------------------------------------------------------
  // Realm
  // ---------------------------------------------------------------------------

  async realm(entityId: ID): Promise<RealmView> {
    const cacheKey = `realm:${entityId}`;
    const cached = this.cache.get<RealmView>(cacheKey);
    if (cached) return cached;

    try {
      const owner = this.getAccount() ?? "0x0";

      // Fetch structure details for this owner
      const structures = await this.sql.fetchPlayerStructures(owner);
      const structure = structures.find((s: any) => s.entity_id === entityId) ?? structures[0];

      // Fetch guards
      const guards = await this.sql.fetchGuardsByStructure(entityId);

      // Fetch resource balances for this specific entity
      const resourceRows = await this.sql.fetchResourceBalances([entityId]);
      const realmResources = this.parseResourceBalanceRows(resourceRows);

      // Fetch armies to find explorers for this realm
      const allArmies = await this.sql.fetchAllArmiesMapData();
      const ownedArmies = allArmies.filter((a: any) => a.owner_address !== undefined && this.sameAddress(a.owner_address, owner));

      const guardState = this.buildGuardState(guards);

      const explorers: ExplorerSummary[] = ownedArmies.slice(0, 20).map((a: any) => ({
        entityId: Number(a.entity_id ?? a.entityId ?? 0),
        explorerId: Number(a.explorer_id ?? a.entity_id ?? 0),
        owner: String(a.owner_address ?? owner),
        position: { x: Number(a.coord_x ?? a.x ?? 0), y: Number(a.coord_y ?? a.y ?? 0) },
        stamina: Number(a.stamina ?? 0),
        maxStamina: 100,
        troops: [],
        strength: 0,
        isInBattle: Boolean(a.is_in_battle ?? false),
        carriedResources: [],
      }));

      const result: RealmView = {
        entityId,
        realmId: Number(structure?.realm_id ?? structure?.realmId ?? entityId),
        name: String(structure?.name ?? `Realm #${entityId}`),
        owner: String(structure?.owner ?? owner),
        position: {
          x: Number(structure?.coord_x ?? structure?.x ?? 0),
          y: Number(structure?.coord_y ?? structure?.y ?? 0),
        },
        level: Number(structure?.level ?? 1),
        resources: realmResources,
        productions: [],
        buildings: [],
        guard: guardState,
        explorers,
        incomingArrivals: [],
        outgoingOrders: [],
        relics: [],
        activeBattles: [],
        nearbyEntities: [],
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      const owner = this.getAccount() ?? "0x0";
      this.logViewError("realm", error, { entityId });
      return {
        entityId,
        realmId: entityId,
        name: `Realm #${entityId}`,
        owner,
        position: { x: 0, y: 0 },
        level: 1,
        resources: [],
        productions: [],
        buildings: [],
        guard: { totalTroops: 0, slots: [], strength: 0 },
        explorers: [],
        incomingArrivals: [],
        outgoingOrders: [],
        relics: [],
        activeBattles: [],
        nearbyEntities: [],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Explorer
  // ---------------------------------------------------------------------------

  async explorer(entityId: ID): Promise<ExplorerView> {
    const cacheKey = `explorer:${entityId}`;
    const cached = this.cache.get<ExplorerView>(cacheKey);
    if (cached) return cached;

    try {
      const allArmies = await this.sql.fetchAllArmiesMapData();
      const army = allArmies.find((a: any) => (a.entity_id ?? a.entityId) === entityId);

      const ownerAddress = (await this.sql.fetchExplorerAddressOwner(entityId)) ?? this.getAccount() ?? "0x0";

      const result: ExplorerView = {
        entityId,
        explorerId: Number(army?.explorer_id ?? army?.entity_id ?? entityId),
        owner: ownerAddress,
        position: {
          x: Number(army?.coord_x ?? army?.x ?? 0),
          y: Number(army?.coord_y ?? army?.y ?? 0),
        },
        stamina: Number(army?.stamina ?? 0),
        maxStamina: 100,
        troops: {
          totalTroops: 0,
          slots: [],
          strength: 0,
        },
        carriedResources: [],
        isInBattle: Boolean(army?.is_in_battle ?? false),
        currentBattle: null,
        nearbyEntities: [],
        recentEvents: [],
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logViewError("explorer", error, { entityId });
      return {
        entityId,
        explorerId: entityId,
        owner: this.getAccount() ?? "0x0",
        position: { x: 0, y: 0 },
        stamina: 0,
        maxStamina: 100,
        troops: { totalTroops: 0, slots: [], strength: 0 },
        carriedResources: [],
        isInBattle: false,
        currentBattle: null,
        nearbyEntities: [],
        recentEvents: [],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Map Area
  // ---------------------------------------------------------------------------

  async mapArea(opts: { x: number; y: number; radius: number }): Promise<MapAreaView> {
    const cacheKey = `mapArea:${opts.x}:${opts.y}:${opts.radius}`;
    const cached = this.cache.get<MapAreaView>(cacheKey);
    if (cached) return cached;

    try {
      const [allStructures, allArmies, allTiles] = await Promise.all([
        this.sql.fetchAllStructuresMapData(),
        this.sql.fetchAllArmiesMapData(),
        this.sql.fetchAllTiles(),
      ]);

      const inRadius = (x: number, y: number) =>
        Math.abs(x - opts.x) <= opts.radius && Math.abs(y - opts.y) <= opts.radius;

      const structures: MapStructure[] = allStructures
        .filter((s: any) => inRadius(Number(s.coord_x ?? s.x ?? 0), Number(s.coord_y ?? s.y ?? 0)))
        .map((s: any) => ({
          entityId: Number(s.entity_id ?? s.entityId ?? 0),
          structureType: String(s.category ?? s.structure_type ?? "unknown"),
          position: { x: Number(s.coord_x ?? s.x ?? 0), y: Number(s.coord_y ?? s.y ?? 0) },
          owner: String(s.owner ?? "0x0"),
          name: String(s.name ?? ""),
          level: Number(s.level ?? 1),
        }));

      const armies: MapArmy[] = allArmies
        .filter((a: any) => inRadius(Number(a.coord_x ?? a.x ?? 0), Number(a.coord_y ?? a.y ?? 0)))
        .map((a: any) => ({
          entityId: Number(a.entity_id ?? a.entityId ?? 0),
          owner: String(a.owner_address ?? "0x0"),
          position: { x: Number(a.coord_x ?? a.x ?? 0), y: Number(a.coord_y ?? a.y ?? 0) },
          troops: [],
          strength: 0,
          stamina: Number(a.stamina ?? 0),
          isInBattle: Boolean(a.is_in_battle ?? false),
        }));

      const tiles: TileState[] = allTiles
        .filter((t: any) => inRadius(Number(t.col ?? t.x ?? 0), Number(t.row ?? t.y ?? 0)))
        .map((t: any) => ({
          position: { x: Number(t.col ?? t.x ?? 0), y: Number(t.row ?? t.y ?? 0) },
          biome: String(t.biome ?? "unknown"),
          explored: Boolean(t.explored ?? true),
          occupiedBy: t.occupier_id ? Number(t.occupier_id) : null,
        }));

      const result: MapAreaView = {
        center: { x: opts.x, y: opts.y },
        radius: opts.radius,
        tiles,
        structures,
        armies,
        battles: [],
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logViewError("mapArea", error, opts);
      return {
        center: { x: opts.x, y: opts.y },
        radius: opts.radius,
        tiles: [],
        structures: [],
        armies: [],
        battles: [],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Market
  // ---------------------------------------------------------------------------

  async market(): Promise<MarketView> {
    const cacheKey = "market";
    const cached = this.cache.get<MarketView>(cacheKey);
    if (cached) return cached;

    try {
      const swapEvents = await this.sql.fetchSwapEvents([]);

      const recentSwaps: SwapEvent[] = swapEvents.slice(0, 50).map((e: any) => ({
        eventId: Number(e.event?.takerId ?? 0),
        resourceId: Number(e.event?.resourceGiven?.resourceId ?? 0),
        resourceName: "",
        lordsAmount: Number(e.event?.resourceGiven?.amount ?? 0),
        resourceAmount: Number(e.event?.resourceTaken?.amount ?? 0),
        isBuy: Boolean(e.event?.resourceGiven?.resourceId === 1),
        timestamp: e.event?.eventTime ? Math.floor(new Date(e.event.eventTime).getTime() / 1000) : 0,
        trader: String(e.event?.takerAddress ?? "0x0"),
      }));

      const result: MarketView = {
        pools: [],
        recentSwaps,
        openOrders: [],
        playerLpPositions: [],
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logViewError("market", error);
      return {
        pools: [],
        recentSwaps: [],
        openOrders: [],
        playerLpPositions: [],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  async player(address: ContractAddress): Promise<PlayerView> {
    const cacheKey = `player:${address}`;
    const cached = this.cache.get<PlayerView>(cacheKey);
    if (cached) return cached;

    try {
      const [structures, playerStructureRows, allArmies, leaderboardByAddress] = await Promise.all([
        this.sql.fetchStructuresByOwner(address),
        this.sql.fetchPlayerStructures(address).catch(() => []),
        this.sql.fetchAllArmiesMapData(),
        this.sql.fetchPlayerLeaderboardByAddress?.(address).catch(() => null) ?? Promise.resolve(null),
      ]);

      const playerStructures: PlayerStructureSummary[] = structures.map((s: any) => ({
        entityId: Number(s.entity_id ?? s.entityId ?? 0),
        structureType: String(s.category ?? s.structure_type ?? "unknown"),
        name: String(s.name ?? ""),
        position: { x: Number(s.coord_x ?? s.x ?? 0), y: Number(s.coord_y ?? s.y ?? 0) },
        level: Number(s.level ?? 1),
        resourceCount: 0,
        guardStrength: 0,
      }));

      const ownedArmies = allArmies.filter((a: any) => this.sameAddress(a.owner_address, address));
      const playerArmies: PlayerArmySummary[] = ownedArmies.map((a: any) => ({
        entityId: Number(a.entity_id ?? a.entityId ?? 0),
        explorerId: Number(a.explorer_id ?? a.entity_id ?? 0),
        position: { x: Number(a.coord_x ?? a.x ?? 0), y: Number(a.coord_y ?? a.y ?? 0) },
        strength: 0,
        stamina: Number(a.stamina ?? 0),
        isInBattle: Boolean(a.is_in_battle ?? false),
        carriedResourceCount: 0,
      }));

      let leaderboardEntry = leaderboardByAddress;
      if (!leaderboardEntry) {
        const leaderboard = await this.sql.fetchPlayerLeaderboard(100, 0).catch(() => []);
        leaderboardEntry = leaderboard.find((row: any) =>
          this.sameAddress(row?.playerAddress ?? row?.address, address),
        );
      }

      // Fetch actual resource balances from the Resource table
      const entityIds = playerStructureRows.map((s: any) => Number(s.entity_id)).filter(Boolean);
      const resourceRows = entityIds.length > 0 ? await this.sql.fetchResourceBalances(entityIds) : [];
      const totalResources = this.aggregateResourceBalancesFromRows(resourceRows);

      const result: PlayerView = {
        address,
        name: String(leaderboardEntry?.playerName ?? ""),
        structures: playerStructures,
        armies: playerArmies,
        totalResources,
        points: Number(leaderboardEntry?.totalPoints ?? 0),
        rank: Number(leaderboardEntry?.rank ?? 0),
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logViewError("player", error, { address });
      return {
        address,
        name: "",
        structures: [],
        armies: [],
        totalResources: [],
        points: 0,
        rank: 0,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Hyperstructure
  // ---------------------------------------------------------------------------

  async hyperstructure(entityId: ID): Promise<HyperstructureView> {
    const cacheKey = `hyperstructure:${entityId}`;
    const cached = this.cache.get<HyperstructureView>(cacheKey);
    if (cached) return cached;

    try {
      const hyperstructures = await this.sql.fetchHyperstructures();
      const hs = hyperstructures.find((h: any) => Number(h.entity_id ?? h.entityId) === entityId);

      const guards = await this.sql.fetchGuardsByStructure(entityId);
      const guardState = this.buildGuardState(guards);

      const result: HyperstructureView = {
        entityId,
        position: {
          x: Number(hs?.coord_x ?? hs?.x ?? 0),
          y: Number(hs?.coord_y ?? hs?.y ?? 0),
        },
        owner: hs?.owner ? String(hs.owner) : null,
        progress: Number(hs?.progress ?? 0),
        contributions: [],
        guard: guardState,
        activeBattles: [],
        isComplete: Number(hs?.progress ?? 0) >= 100,
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logViewError("hyperstructure", error, { entityId });
      return {
        entityId,
        position: { x: 0, y: 0 },
        owner: null,
        progress: 0,
        contributions: [],
        guard: { totalTroops: 0, slots: [], strength: 0 },
        activeBattles: [],
        isComplete: false,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Leaderboard
  // ---------------------------------------------------------------------------

  async leaderboard(opts?: { limit?: number; offset?: number }): Promise<LeaderboardView> {
    const limit = opts?.limit ?? 10;
    const offset = opts?.offset ?? 0;
    const cacheKey = `leaderboard:${limit}:${offset}`;
    const cached = this.cache.get<LeaderboardView>(cacheKey);
    if (cached) return cached;

    try {
      const rows = await this.sql.fetchPlayerLeaderboard(limit, offset);

      const entries: LeaderboardEntry[] = rows.map((r: any) => ({
        address: String(r.playerAddress ?? r.address ?? "0x0"),
        name: String(r.playerName ?? r.name ?? ""),
        points: Number(r.totalPoints ?? r.points ?? 0),
        rank: Number(r.rank ?? 0),
        realmCount: Number(r.realmCount ?? 0),
      }));

      const result: LeaderboardView = {
        entries,
        totalPlayers: entries.length,
        lastUpdatedAt: this.currentTimestamp(),
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logViewError("leaderboard", error, { limit, offset });
      return {
        entries: [],
        totalPlayers: 0,
        lastUpdatedAt: this.currentTimestamp(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Bank
  // ---------------------------------------------------------------------------

  async bank(bankEntityId: ID): Promise<BankView> {
    const cacheKey = `bank:${bankEntityId}`;
    const cached = this.cache.get<BankView>(cacheKey);
    if (cached) return cached;

    try {
      // Bank data comes from structure + swap events
      const allStructures = await this.sql.fetchAllStructuresMapData();
      const bankStruct = allStructures.find((s: any) => Number(s.entity_id ?? s.entityId) === bankEntityId);

      const swapEvents = await this.sql.fetchSwapEvents([]);
      const recentSwaps: SwapEvent[] = swapEvents.slice(0, 20).map((e: any) => ({
        eventId: Number(e.event?.takerId ?? 0),
        resourceId: Number(e.event?.resourceGiven?.resourceId ?? 0),
        resourceName: "",
        lordsAmount: Number(e.event?.resourceGiven?.amount ?? 0),
        resourceAmount: Number(e.event?.resourceTaken?.amount ?? 0),
        isBuy: Boolean(e.event?.resourceGiven?.resourceId === 1),
        timestamp: e.event?.eventTime ? Math.floor(new Date(e.event.eventTime).getTime() / 1000) : 0,
        trader: String(e.event?.takerAddress ?? "0x0"),
      }));

      const result: BankView = {
        entityId: bankEntityId,
        position: {
          x: Number(bankStruct?.coord_x ?? bankStruct?.x ?? 0),
          y: Number(bankStruct?.coord_y ?? bankStruct?.y ?? 0),
        },
        pools: [],
        recentSwaps,
        playerLpPositions: [],
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logViewError("bank", error, { bankEntityId });
      return {
        entityId: bankEntityId,
        position: { x: 0, y: 0 },
        pools: [],
        recentSwaps: [],
        playerLpPositions: [],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  async events(opts?: {
    entityId?: ID;
    owner?: string;
    since?: number;
    limit?: number;
    offset?: number;
  }): Promise<EventsView> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const cacheKey = `events:${opts?.entityId ?? ""}:${opts?.owner ?? ""}:${opts?.since ?? ""}:${limit}:${offset}`;
    const cached = this.cache.get<EventsView>(cacheKey);
    if (cached) return cached;

    try {
      let rawEvents: any[];

      if (opts?.entityId) {
        rawEvents = await this.sql.fetchStoryEventsByEntity(opts.entityId, limit, offset);
      } else if (opts?.owner) {
        rawEvents = await this.sql.fetchStoryEventsByOwner(opts.owner, limit, offset);
      } else {
        rawEvents = await this.sql.fetchStoryEvents(limit, offset);
      }

      const totalCount = await this.sql.fetchStoryEventsCount();

      const events: GameEvent[] = rawEvents.map((e: any) => ({
        eventId: Number(e.event_id ?? e.id ?? 0),
        eventType: String(e.event_type ?? e.type ?? "unknown"),
        timestamp: Number(e.timestamp ?? 0),
        data: e.data ?? {},
        involvedEntities: Array.isArray(e.involved_entities) ? e.involved_entities.map(Number) : [],
      }));

      const result: EventsView = {
        events,
        totalCount,
        hasMore: offset + events.length < totalCount,
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logViewError("events", error, opts);
      return {
        events: [],
        totalCount: 0,
        hasMore: false,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private logViewError(viewName: string, error: unknown, context?: unknown): void {
    this.logger.warn(`[ViewClient] ${viewName} query failed; returning fallback`, {
      error,
      context,
    });
  }

  private sameAddress(a: unknown, b: unknown): boolean {
    const normalize = (value: unknown) =>
      String(value ?? "")
        .trim()
        .toLowerCase();
    return normalize(a) !== "" && normalize(a) === normalize(b);
  }

  private static readonly RESOURCE_PRECISION = 1_000_000_000_000_000_000n; // 1e18
  private static readonly ZERO_HEX = "0x00000000000000000000000000000000";

  /**
   * Parse a hex balance string from the Resource table into a whole-number balance.
   * On-chain values use 1e18 precision; this divides to get the integer part.
   */
  private parseHexBalance(hex: unknown): number {
    if (typeof hex !== "string" || hex === ViewClient.ZERO_HEX) return 0;
    try {
      const raw = BigInt(hex);
      if (raw <= 0n) return 0;
      return Number(raw / ViewClient.RESOURCE_PRECISION);
    } catch {
      return 0;
    }
  }

  /**
   * Parse raw ResourceBalanceRow rows into ResourceState objects for a single entity.
   * Returns only resources with non-zero balances.
   */
  private parseResourceBalanceRows(rows: any[]): any[] {
    const results: any[] = [];

    for (const row of rows) {
      for (const col of RESOURCE_BALANCE_COLUMNS) {
        const hex = row[col.column];
        const balance = this.parseHexBalance(hex);
        if (balance > 0) {
          results.push({
            resourceId: col.resourceId,
            name: col.name,
            tier: "",
            balance,
            rawBalance: typeof hex === "string" ? BigInt(hex) : 0n,
            production: null,
            atMaxCapacity: false,
            weightKg: 0,
          });
        }
      }
    }

    return results.sort((a: any, b: any) => a.resourceId - b.resourceId);
  }

  /**
   * Aggregate resource balances from multiple ResourceBalanceRow rows (across structures).
   * Returns totals per resource with structure counts.
   */
  private aggregateResourceBalancesFromRows(
    rows: any[],
  ): { resourceId: number; name: string; totalBalance: number; totalProduction: number; structureCount: number }[] {
    const aggregates = new Map<
      number,
      { resourceId: number; name: string; totalBalance: number; structures: Set<number> }
    >();

    for (const row of rows) {
      const entityId = Number(row.entity_id ?? 0);
      for (const col of RESOURCE_BALANCE_COLUMNS) {
        const balance = this.parseHexBalance(row[col.column]);
        if (balance <= 0) continue;

        const current = aggregates.get(col.resourceId) ?? {
          resourceId: col.resourceId,
          name: col.name,
          totalBalance: 0,
          structures: new Set<number>(),
        };
        current.totalBalance += balance;
        if (entityId > 0) current.structures.add(entityId);
        aggregates.set(col.resourceId, current);
      }
    }

    return Array.from(aggregates.values())
      .map((r) => ({
        resourceId: r.resourceId,
        name: r.name,
        totalBalance: r.totalBalance,
        totalProduction: 0,
        structureCount: r.structures.size,
      }))
      .sort((a, b) => a.resourceId - b.resourceId);
  }

  private buildGuardState(guards: any[]): GuardState {
    if (!guards || guards.length === 0) {
      return { totalTroops: 0, slots: [], strength: 0 };
    }

    const slots = guards
      .filter((g: any) => g.troops !== null && g.troops !== undefined)
      .map((g: any) => ({
        troopType: String(g.troops?.category ?? "unknown"),
        count: Number(g.troops?.count ?? 0),
        tier: Number(g.troops?.tier ?? 1),
      }));

    const totalTroops = slots.reduce((sum, s) => sum + s.count, 0);
    const strength = slots.reduce((sum, s) => sum + computeStrength(s.count, s.tier), 0);

    return { totalTroops, slots, strength };
  }
}
