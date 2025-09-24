import LRUCache from "lru-cache";

import { SqlApi } from "@bibliothecadao/torii";
import type {
  ArmyMapDataRaw,
  BattleLogEvent,
  PlayerRelicsData,
  PlayersData,
  PlayerStructure,
  StructureMapDataRaw,
  Tile,
  TradeEvent,
} from "@bibliothecadao/torii";
import { StructureType } from "@bibliothecadao/types";

import type {
  ArmySummary,
  BattleLogSummary,
  MarketSwapSummary,
  PlayerProfile,
  RealmSummary,
  TileSummary,
} from "../types.js";

interface ToriiAdapterCacheOptions {
  realmTtl?: number;
  armyTtl?: number;
  tileTtl?: number;
  playerTtl?: number;
  marketTtl?: number;
  battleTtl?: number;
  maxEntries?: number;
}

export interface ToriiAdapterOptions {
  cache?: ToriiAdapterCacheOptions;
}

const DEFAULT_TTL = 5_000;
const BIGINT_ZERO = 0n;

function hexToBigIntSafe(value?: string | null): bigint {
  if (!value) return BIGINT_ZERO;
  try {
    return value.startsWith("0x") ? BigInt(value) : BigInt(`0x${value}`);
  } catch {
    return BIGINT_ZERO;
  }
}

function numericStringToNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (value.startsWith("0x")) {
    try {
      return Number(BigInt(value));
    } catch {
      return 0;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAddress(address: string): string {
  try {
    return `0x${BigInt(address).toString(16).padStart(64, "0")}`;
  } catch {
    return address.toLowerCase();
  }
}

function mapStructureToRealmSummary(structure: StructureMapDataRaw): RealmSummary | null {
  if (structure.structure_type !== StructureType.Realm) {
    return null;
  }

  return {
    entityId: structure.entity_id,
    realmId: structure.realm_id ?? null,
    ownerAddress: structure.owner_address,
    ownerName: structure.owner_name,
    level: structure.level,
    structureType: structure.structure_type,
    coord: { x: structure.coord_x, y: structure.coord_y },
    resourcesPacked: structure.resources_packed,
    raw: structure,
  };
}

function mapArmyToSummary(army: ArmyMapDataRaw): ArmySummary {
  return {
    entityId: army.entity_id,
    coord: { x: army.coord_x, y: army.coord_y },
    ownerAddress: army.owner_address ?? undefined,
    ownerName: army.owner_name ?? undefined,
    troopCategory: army.category ?? undefined,
    troopTier: army.tier ?? undefined,
    troopCount: hexToBigIntSafe(army.count),
    staminaAmount: army.stamina_amount ? hexToBigIntSafe(army.stamina_amount) : null,
    battleCooldownEnd: army.battle_cooldown_end ?? null,
    raw: army,
  };
}

function mapTileToSummary(tile: Tile): TileSummary {
  return {
    coord: { x: tile.col, y: tile.row },
    biome: tile.biome,
    occupierId: tile.occupier_id,
    occupierType: tile.occupier_type,
    occupierIsStructure: tile.occupier_is_structure,
  };
}

function mapSwapEvent(event: TradeEvent): MarketSwapSummary {
  return {
    takerId: event.event.takerId,
    takerAddress: event.event.takerAddress,
    makerId: event.event.makerId,
    makerAddress: event.event.makerAddress,
    resourceGivenId: event.event.resourceGiven.resourceId,
    resourceGivenAmount: event.event.resourceGiven.amount,
    resourceTakenId: event.event.resourceTaken.resourceId,
    resourceTakenAmount: event.event.resourceTaken.amount,
    timestamp: event.event.eventTime.getTime(),
    raw: event,
  };
}

function mapBattleLog(event: BattleLogEvent): BattleLogSummary {
  return {
    attackerId: event.attacker_id,
    defenderId: event.defender_id,
    attackerOwnerId: event.attacker_owner_id,
    defenderOwnerId: event.defender_owner_id,
    winnerId: event.winner_id,
    maxReward: numericStringToNumber(event.max_reward),
    success: event.success,
    timestamp: numericStringToNumber(event.timestamp) * 1000,
    raw: event,
  };
}

export class ToriiAdapter {
  private readonly realmCache: LRUCache<number, RealmSummary>;
  private readonly armyCache: LRUCache<number, ArmySummary>;
  private readonly tileCache: LRUCache<string, TileSummary>;
  private readonly playerCache: LRUCache<string, PlayerProfile>;
  private readonly marketCache: LRUCache<string, MarketSwapSummary[]>;
  private readonly battleCache: LRUCache<string, BattleLogSummary[]>;

  constructor(private readonly sqlApi: SqlApi, options?: ToriiAdapterOptions) {
    const cacheConfig = options?.cache ?? {};
    const maxEntries = cacheConfig.maxEntries ?? 500;

    this.realmCache = new LRUCache({ ttl: cacheConfig.realmTtl ?? DEFAULT_TTL, max: maxEntries });
    this.armyCache = new LRUCache({ ttl: cacheConfig.armyTtl ?? DEFAULT_TTL, max: maxEntries });
    this.tileCache = new LRUCache({ ttl: cacheConfig.tileTtl ?? DEFAULT_TTL, max: maxEntries });
    this.playerCache = new LRUCache({ ttl: cacheConfig.playerTtl ?? DEFAULT_TTL, max: maxEntries });
    this.marketCache = new LRUCache({ ttl: cacheConfig.marketTtl ?? DEFAULT_TTL, max: 1 });
    this.battleCache = new LRUCache({ ttl: cacheConfig.battleTtl ?? DEFAULT_TTL, max: 1 });
  }

  async listRealmSummaries(): Promise<RealmSummary[]> {
    const structures = await this.sqlApi.fetchAllStructuresMapData();
    const summaries: RealmSummary[] = [];

    structures.forEach((structure) => {
      const summary = mapStructureToRealmSummary(structure);
      if (!summary) return;
      summaries.push(summary);
      this.realmCache.set(summary.entityId, summary);
    });

    return summaries;
  }

  async getRealmSummary(realmId: number): Promise<RealmSummary | null> {
    const cached = this.realmCache.get(realmId);
    if (cached) {
      return cached;
    }

    const summaries = await this.listRealmSummaries();
    return summaries.find((realm) => realm.entityId === realmId) ?? null;
  }

  async listArmySummaries(): Promise<ArmySummary[]> {
    const armies = await this.sqlApi.fetchAllArmiesMapData();
    const summaries = armies.map(mapArmyToSummary);
    summaries.forEach((summary) => this.armyCache.set(summary.entityId, summary));
    return summaries;
  }

  async getArmySummary(entityId: number): Promise<ArmySummary | null> {
    const cached = this.armyCache.get(entityId);
    if (cached) {
      return cached;
    }

    const summaries = await this.listArmySummaries();
    return summaries.find((army) => army.entityId === entityId) ?? null;
  }

  async getTileSummary(x: number, y: number): Promise<TileSummary | null> {
    const cacheKey = `${x},${y}`;
    const cached = this.tileCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tiles = await this.sqlApi.fetchTilesByCoords([{ col: x, row: y }]);
    const tile = tiles[0];
    if (!tile) {
      return null;
    }

    const summary = mapTileToSummary(tile);
    this.tileCache.set(cacheKey, summary);
    return summary;
  }

  async listMarketSwaps(): Promise<MarketSwapSummary[]> {
    const cacheKey = "market-swaps";
    const cached = this.marketCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const swaps = await this.sqlApi.fetchSwapEvents([]);
    const summaries = swaps.map(mapSwapEvent);
    this.marketCache.set(cacheKey, summaries);
    return summaries;
  }

  async getPlayerProfile(address: string): Promise<PlayerProfile | null> {
    const normalized = normalizeAddress(address);
    const cached = this.playerCache.get(normalized);
    if (cached) {
      return cached;
    }

    const [structures, relics, globalDetails]: [
      PlayerStructure[],
      PlayerRelicsData,
      PlayersData[],
    ] = await Promise.all([
      this.sqlApi.fetchPlayerStructures(address),
      this.sqlApi.fetchAllPlayerRelics(address),
      this.sqlApi.fetchGlobalStructureExplorerAndGuildDetails(),
    ]);

    const statsRow = globalDetails.find(
      (row) => normalizeAddress(row.owner_address) === normalized,
    );

    const stats = statsRow
      ? {
          realms: statsRow.realms_count ?? 0,
          hyperstructures: statsRow.hyperstructures_count ?? 0,
          banks: statsRow.bank_count ?? 0,
          mines: statsRow.mine_count ?? 0,
          villages: statsRow.village_count ?? 0,
          explorerCount: typeof statsRow.explorer_ids === "string"
            ? statsRow.explorer_ids.split(",").filter(Boolean).length
            : Number(statsRow.explorer_ids ?? 0),
          guildId: statsRow.guild_id,
          guildName: statsRow.guild_name,
          playerName: statsRow.player_name,
        }
      : undefined;

    const profile: PlayerProfile = {
      ownerAddress: normalized,
      structures,
      relics,
      stats,
    };

    this.playerCache.set(normalized, profile);
    return profile;
  }

  async listBattleLogs(afterTimestamp?: number): Promise<BattleLogSummary[]> {
    const cacheKey = afterTimestamp ? `battle-${afterTimestamp}` : "battle-all";
    if (!afterTimestamp) {
      const cached = this.battleCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const rawEvents = await this.sqlApi.fetchBattleLogs(
      afterTimestamp ? Math.floor(afterTimestamp / 1000).toString() : undefined,
    );
    const summaries = rawEvents.map(mapBattleLog);

    if (!afterTimestamp) {
      this.battleCache.set(cacheKey, summaries);
    }

    return summaries;
  }
}
