import type { WorldState } from "@bibliothecadao/game-agent";
import type { EternumClient } from "@bibliothecadao/client";

/**
 * Column-name → { resourceId, name } mapping for the s1_eternum-Resource table.
 * Mirrors ResourceManager.getResourceMapping() from @bibliothecadao/core.
 * Only includes gameplay-relevant resources (skips relics).
 */
const RESOURCE_COLUMN_MAP: Record<string, { id: number; name: string }> = {
  STONE_BALANCE: { id: 1, name: "Stone" },
  COAL_BALANCE: { id: 2, name: "Coal" },
  WOOD_BALANCE: { id: 3, name: "Wood" },
  COPPER_BALANCE: { id: 4, name: "Copper" },
  IRONWOOD_BALANCE: { id: 5, name: "Ironwood" },
  OBSIDIAN_BALANCE: { id: 6, name: "Obsidian" },
  GOLD_BALANCE: { id: 7, name: "Gold" },
  SILVER_BALANCE: { id: 8, name: "Silver" },
  MITHRAL_BALANCE: { id: 9, name: "Mithral" },
  ALCHEMICAL_SILVER_BALANCE: { id: 10, name: "Alchemical Silver" },
  COLD_IRON_BALANCE: { id: 11, name: "Cold Iron" },
  DEEP_CRYSTAL_BALANCE: { id: 12, name: "Deep Crystal" },
  RUBY_BALANCE: { id: 13, name: "Ruby" },
  DIAMONDS_BALANCE: { id: 14, name: "Diamonds" },
  HARTWOOD_BALANCE: { id: 15, name: "Hartwood" },
  IGNIUM_BALANCE: { id: 16, name: "Ignium" },
  TWILIGHT_QUARTZ_BALANCE: { id: 17, name: "Twilight Quartz" },
  TRUE_ICE_BALANCE: { id: 18, name: "True Ice" },
  ADAMANTINE_BALANCE: { id: 19, name: "Adamantine" },
  SAPPHIRE_BALANCE: { id: 20, name: "Sapphire" },
  ETHEREAL_SILICA_BALANCE: { id: 21, name: "Ethereal Silica" },
  DRAGONHIDE_BALANCE: { id: 22, name: "Dragonhide" },
  LABOR_BALANCE: { id: 23, name: "Labor" },
  EARTHEN_SHARD_BALANCE: { id: 24, name: "Ancient Fragment" },
  DONKEY_BALANCE: { id: 25, name: "Donkey" },
  KNIGHT_T1_BALANCE: { id: 26, name: "Knight" },
  KNIGHT_T2_BALANCE: { id: 27, name: "Knight T2" },
  KNIGHT_T3_BALANCE: { id: 28, name: "Knight T3" },
  CROSSBOWMAN_T1_BALANCE: { id: 29, name: "Crossbowman" },
  CROSSBOWMAN_T2_BALANCE: { id: 30, name: "Crossbowman T2" },
  CROSSBOWMAN_T3_BALANCE: { id: 31, name: "Crossbowman T3" },
  PALADIN_T1_BALANCE: { id: 32, name: "Paladin" },
  PALADIN_T2_BALANCE: { id: 33, name: "Paladin T2" },
  PALADIN_T3_BALANCE: { id: 34, name: "Paladin T3" },
  WHEAT_BALANCE: { id: 35, name: "Wheat" },
  FISH_BALANCE: { id: 36, name: "Fish" },
  LORDS_BALANCE: { id: 37, name: "Lords" },
  ESSENCE_BALANCE: { id: 38, name: "Essence" },
};

/**
 * Building category → name mapping. Mirrors BuildingTypeToString from @bibliothecadao/types.
 */
const BUILDING_CATEGORY_MAP: Record<number, string> = {
  0: "None",
  1: "Workers Hut",
  2: "Storehouse",
  3: "Stone",
  4: "Coal",
  5: "Wood",
  6: "Copper",
  7: "Ironwood",
  8: "Obsidian",
  9: "Gold",
  10: "Silver",
  11: "Mithral",
  12: "Alchemical Silver",
  13: "Cold Iron",
  14: "Deep Crystal",
  15: "Ruby",
  16: "Diamonds",
  17: "Hartwood",
  18: "Ignium",
  19: "Twilight Quartz",
  20: "True Ice",
  21: "Adamantine",
  22: "Sapphire",
  23: "Ethereal Silica",
  24: "Dragonhide",
  25: "Labor",
  26: "Ancient Fragment",
  27: "Market",
  28: "Knight Barracks",
  29: "Knight T2 Barracks",
  30: "Knight T3 Barracks",
  31: "Crossbowman Range",
  32: "Crossbowman T2 Range",
  33: "Crossbowman T3 Range",
  34: "Paladin Stable",
  35: "Paladin T2 Stable",
  36: "Paladin T3 Stable",
  37: "Farm",
  38: "Fishing Village",
  39: "Essence Mine",
};

const ZERO_BALANCE = "0x" + "0".repeat(32);

/** Parse the wide-column s1_eternum-Resource row into resource balances. */
function parseResourceRow(row: Record<string, unknown>): { resourceId: number; name: string; balance: number }[] {
  const results: { resourceId: number; name: string; balance: number }[] = [];
  for (const [col, mapping] of Object.entries(RESOURCE_COLUMN_MAP)) {
    const raw = row[col];
    if (raw == null || raw === ZERO_BALANCE) continue;
    const balance = typeof raw === "string" ? Number(BigInt(raw)) : Number(raw);
    if (balance > 0) {
      results.push({ resourceId: mapping.id, name: mapping.name, balance });
    }
  }
  return results;
}

/** Hex-encoded u64/u128 → number. Handles both raw numbers and 0x-prefixed hex strings. */
function parseHexOrNum(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string" && val.startsWith("0x")) return Number(BigInt(val));
  return Number(val);
}

/** Biome ID → name mapping. */
const BIOME_NAMES: Record<number, string> = {
  0: "deep_ocean", 1: "ocean", 2: "beach", 3: "scorched", 4: "bare",
  5: "tundra", 6: "snow", 7: "temperate_desert", 8: "shrubland",
  9: "taiga", 10: "grassland", 11: "temperate_deciduous_forest",
  12: "temperate_rain_forest", 13: "subtropical_desert", 14: "tropical_seasonal_forest",
  15: "tropical_rain_forest",
};

// ---------------------------------------------------------------------------
// Hex grid neighbor computation (even-r offset coordinates)
// Mirrors NEIGHBOR_OFFSETS_EVEN / NEIGHBOR_OFFSETS_ODD from @bibliothecadao/types
// Direction enum: 0=EAST, 1=NE, 2=NW, 3=WEST, 4=SW, 5=SE
// ---------------------------------------------------------------------------

const HEX_OFFSETS_EVEN = [
  { di: 1, dj: 0 },  // 0 EAST
  { di: 1, dj: 1 },  // 1 NE
  { di: 0, dj: 1 },  // 2 NW
  { di: -1, dj: 0 }, // 3 WEST
  { di: 0, dj: -1 }, // 4 SW
  { di: 1, dj: -1 }, // 5 SE
];

const HEX_OFFSETS_ODD = [
  { di: 1, dj: 0 },  // 0 EAST
  { di: 0, dj: 1 },  // 1 NE
  { di: -1, dj: 1 }, // 2 NW
  { di: -1, dj: 0 }, // 3 WEST
  { di: -1, dj: -1 },// 4 SW
  { di: 0, dj: -1 }, // 5 SE
];

const DIRECTION_NAMES = ["East", "NorthEast", "NorthWest", "West", "SouthWest", "SouthEast"];

function hexNeighbors(col: number, row: number): { col: number; row: number; direction: number }[] {
  const offsets = row % 2 === 0 ? HEX_OFFSETS_EVEN : HEX_OFFSETS_ODD;
  return offsets.map((o, dir) => ({ col: col + o.di, row: row + o.dj, direction: dir }));
}

/**
 * Build tile visibility from raw Tile data (from TileOpt SQL table).
 * All tiles in TileOpt are explored. Frontier = explored tiles with at least
 * one hex neighbor NOT in the explored set.
 */
function buildTileVisibility(tiles: { col: number; row: number; biome: number }[]): TileVisibility {
  const exploredSet = new Set(tiles.map((t) => `${t.col},${t.row}`));
  const frontierTiles: TileVisibility["frontierTiles"] = [];

  for (const t of tiles) {
    const unexploredDirs = hexNeighbors(t.col, t.row)
      .filter((n) => !exploredSet.has(`${n.col},${n.row}`));
    if (unexploredDirs.length > 0) {
      frontierTiles.push({ x: t.col, y: t.row, biome: BIOME_NAMES[t.biome] ?? "unknown" });
    }
  }

  return { exploredCount: tiles.length, frontierTiles };
}

/**
 * For a given position, return which hex directions lead to unexplored tiles.
 * Returns direction indices (0-5) with names, so the agent knows exactly
 * which direction to pass to move_explorer with explore=true.
 */
function unexploredDirectionsFrom(
  col: number,
  row: number,
  exploredSet: Set<string>,
): { direction: number; name: string; targetX: number; targetY: number }[] {
  return hexNeighbors(col, row)
    .filter((n) => !exploredSet.has(`${n.col},${n.row}`))
    .map((n) => ({ direction: n.direction, name: DIRECTION_NAMES[n.direction], targetX: n.col, targetY: n.row }));
}

/** Parse WorldConfig row + structure level config + resource lists + building/production config into a GameConfig. */
function parseGameConfig(
  worldRow: Record<string, unknown>,
  levelConfigs: { level: number; required_resource_count: number; required_resources_id: number }[],
  resourceLists?: { entity_id: number; index: number; resource_type: number; amount: string | number }[],
  buildingCategories?: Record<string, unknown>[],
  resourceFactories?: Record<string, unknown>[],
): GameConfig {
  const g = (key: string) => parseHexOrNum(worldRow[key]);

  // Group resource lists by entity_id for quick lookup
  const resourcesByEntityId = new Map<number, { resourceType: number; amount: number }[]>();
  if (resourceLists) {
    for (const r of resourceLists) {
      const eid = Number(r.entity_id);
      if (!resourcesByEntityId.has(eid)) resourcesByEntityId.set(eid, []);
      resourcesByEntityId.get(eid)!.push({
        resourceType: Number(r.resource_type),
        amount: parseHexOrNum(r.amount),
      });
    }
  }

  return {
    stamina: {
      exploreCost: g("troop_stamina_config.stamina_explore_stamina_cost"),
      travelCost: g("troop_stamina_config.stamina_travel_stamina_cost"),
      gainPerTick: g("troop_stamina_config.stamina_gain_per_tick"),
      bonusValue: g("troop_stamina_config.stamina_bonus_value"),
      attackReq: g("troop_stamina_config.stamina_attack_req"),
      defenseReq: g("troop_stamina_config.stamina_defense_req"),
      maxStamina: {
        knight: g("troop_stamina_config.stamina_knight_max"),
        paladin: g("troop_stamina_config.stamina_paladin_max"),
        crossbowman: g("troop_stamina_config.stamina_crossbowman_max"),
      },
      exploreWheatCost: g("troop_stamina_config.stamina_explore_wheat_cost"),
      exploreFishCost: g("troop_stamina_config.stamina_explore_fish_cost"),
      travelWheatCost: g("troop_stamina_config.stamina_travel_wheat_cost"),
      travelFishCost: g("troop_stamina_config.stamina_travel_fish_cost"),
    },
    realm: {
      maxLevel: g("structure_max_level_config.realm_max"),
      upgradeCosts: levelConfigs.map((lc) => ({
        level: Number(lc.level),
        requiredResourceCount: Number(lc.required_resource_count),
        resourcesId: Number(lc.required_resources_id),
        resources: resourcesByEntityId.get(Number(lc.required_resources_id)),
      })),
    },
    buildings: {
      basePopulation: g("building_config.base_population"),
      costIncreasePercent: g("building_config.base_cost_percent_increase"),
      categories: buildingCategories?.map((b) => ({
        category: Number(b.category ?? 0),
        name: BUILDING_CATEGORY_MAP[Number(b.category ?? 0)] ?? `Unknown (${b.category})`,
        populationCost: Number(b.population_cost ?? 0),
        capacityGrant: Number(b.capacity_grant ?? 0),
        simpleErectionCostId: Number(b.simple_erection_cost_id ?? 0),
        simpleErectionCostCount: Number(b.simple_erection_cost_count ?? 0),
        complexErectionCostId: Number(b.complex_erection_cost_id ?? 0),
        complexErectionCostCount: Number(b.complex_erection_cost_count ?? 0),
      })),
    },
    production: resourceFactories?.map((f) => {
      const resId = Number(f.resource_type ?? 0);
      const mapping = Object.values(RESOURCE_COLUMN_MAP).find((m) => m.id === resId);
      return {
        resourceType: resId,
        name: mapping?.name ?? `Resource ${resId}`,
        realmOutputPerSecond: parseHexOrNum(f.realm_output_per_second),
        villageOutputPerSecond: parseHexOrNum(f.village_output_per_second),
        simpleInputListCount: Number(f.simple_input_list_count ?? 0),
        complexInputListCount: Number(f.complex_input_list_count ?? 0),
      };
    }),
    combat: {
      biomeBonusNum: g("troop_damage_config.damage_biome_bonus_num"),
    },
    tick: {
      armiesTickSeconds: g("tick_config.armies_tick_in_seconds"),
    },
  };
}

/**
 * An entity in the Eternum world, representing a structure, army, or realm
 * in a unified format suitable for the autonomous agent framework.
 */
export interface EternumEntity {
  type: "structure" | "army" | "realm";
  entityId: number;
  owner: string;
  position: { x: number; y: number };
  name?: string;
  // Structure-specific
  structureType?: string;
  level?: number;
  // Structure detail (from realm view)
  guardSlots?: { troopType: string; count: number; tier: number }[];
  guardStrength?: number;
  buildings?: { category: string; paused: boolean; position: { x: number; y: number } }[];
  resourceBalances?: { resourceId: number; name: string; balance: number }[];
  // Army-specific
  explorerId?: number;
  strength?: number;
  stamina?: number;
  isInBattle?: boolean;
  // Explorer detail (from explorer view)
  troops?: { totalTroops: number; slots: { troopType: string; count: number; tier: number }[]; strength: number };
  carriedResources?: { resourceId: number; name: string; amount: number }[];
  // Exploration guidance: which directions from this entity lead to unexplored tiles
  unexploredDirections?: { direction: number; name: string; targetX: number; targetY: number }[];
}

/** Tile visibility summary for the agent. */
export interface TileVisibility {
  /** Total explored tiles in the queried area. */
  exploredCount: number;
  /** Explored tiles adjacent to at least one unexplored tile — best candidates for explore action. */
  frontierTiles: { x: number; y: number; biome: string }[];
}

/** Parsed game configuration from live Torii SQL. */
export interface GameConfig {
  stamina: {
    exploreCost: number;
    travelCost: number;
    gainPerTick: number;
    bonusValue: number;
    attackReq: number;
    defenseReq: number;
    maxStamina: { knight: number; paladin: number; crossbowman: number };
    exploreWheatCost: number;
    exploreFishCost: number;
    travelWheatCost: number;
    travelFishCost: number;
  };
  realm: {
    maxLevel: number;
    upgradeCosts: {
      level: number;
      requiredResourceCount: number;
      resourcesId: number;
      resources?: { resourceType: number; amount: number }[];
    }[];
  };
  buildings: {
    basePopulation: number;
    costIncreasePercent: number;
    categories?: {
      category: number;
      name: string;
      populationCost: number;
      capacityGrant: number;
      simpleErectionCostId: number;
      simpleErectionCostCount: number;
      complexErectionCostId: number;
      complexErectionCostCount: number;
    }[];
  };
  production?: {
    resourceType: number;
    name: string;
    realmOutputPerSecond: number;
    villageOutputPerSecond: number;
    simpleInputListCount: number;
    complexInputListCount: number;
  }[];
  combat: {
    biomeBonusNum: number;
  };
  tick: {
    armiesTickSeconds: number;
  };
}

/**
 * Extended world state for Eternum, combining the generic WorldState
 * with game-specific player, market, and leaderboard data.
 */
export interface EternumWorldState extends WorldState<EternumEntity> {
  player: {
    address: string;
    name: string;
    structures: number;
    armies: number;
    points: number;
    rank: number;
  };
  market: {
    recentSwapCount: number;
    openOrderCount: number;
  };
  leaderboard: {
    topPlayers: { name: string; points: number; rank: number }[];
    totalPlayers: number;
  };
  tiles?: TileVisibility;
  gameConfig?: GameConfig;
  recentEvents?: { eventId: number; eventType: string; timestamp: number; data: Record<string, unknown> }[];
  hyperstructures?: { entityId: number; position: { x: number; y: number }; owner: string | null; progress: number; isComplete: boolean }[];
  banks?: { entityId: number; position: { x: number; y: number } }[];
}

/**
 * Build a snapshot of the Eternum world state by querying all relevant
 * view methods on the client in parallel.
 *
 * Uses `client.view.player()` for the player's own structures/armies (queried by owner),
 * then queries `mapArea` centered on the player's first structure to see nearby entities.
 *
 * @param client - An initialized EternumClient instance
 * @param accountAddress - The player's on-chain address
 * @returns A fully populated EternumWorldState
 */
export async function buildWorldState(
  client: EternumClient,
  accountAddress: string,
): Promise<EternumWorldState> {
  // First fetch player data to know our structure positions
  const [playerView, marketView, leaderboardView] = await Promise.all([
    client.view.player(accountAddress),
    client.view.market(),
    client.view.leaderboard({ limit: 10 }),
  ]);

  const playerStructures = Array.isArray((playerView as any)?.structures) ? (playerView as any).structures : [];
  const playerArmies = Array.isArray((playerView as any)?.armies) ? (playerView as any).armies : [];
  const recentSwaps = Array.isArray((marketView as any)?.recentSwaps) ? (marketView as any).recentSwaps : [];
  const openOrders = Array.isArray((marketView as any)?.openOrders) ? (marketView as any).openOrders : [];
  const leaderboardEntries = Array.isArray((leaderboardView as any)?.entries)
    ? (leaderboardView as any).entries
    : [];

  // Build entities from the player's own structures and armies
  const structureEntities: EternumEntity[] = playerStructures.map((s: any) => ({
    type: "structure" as const,
    entityId: Number(s.entityId ?? s.entity_id ?? 0),
    owner: String(s.owner ?? accountAddress),
    position: {
      x: Number(s.position?.x ?? s.coord_x ?? s.x ?? 0),
      y: Number(s.position?.y ?? s.coord_y ?? s.y ?? 0),
    },
    name: s.name || undefined,
    structureType: String(s.structureType ?? s.category ?? s.structure_type ?? "unknown"),
    level: Number(s.level ?? 1),
  }));

  const armyEntities: EternumEntity[] = playerArmies.map((a: any) => ({
    type: "army" as const,
    entityId: Number(a.entityId ?? a.entity_id ?? 0),
    explorerId: Number(a.explorerId ?? a.explorer_id ?? a.entityId ?? a.entity_id ?? 0),
    owner: String(a.owner ?? accountAddress),
    position: {
      x: Number(a.position?.x ?? a.coord_x ?? a.x ?? 0),
      y: Number(a.position?.y ?? a.coord_y ?? a.y ?? 0),
    },
    strength: Number(a.strength ?? a.guardStrength ?? 0),
    stamina: Number(a.stamina ?? 0),
    isInBattle: Boolean(a.isInBattle ?? a.is_in_battle ?? false),
  }));

  // Query nearby entities and tiles using bounded SQL (avoids fetching the entire game)
  let nearbyEntities: EternumEntity[] = [];
  let tiles: TileVisibility | undefined;
  let exploredSet: Set<string> | undefined;
  if (structureEntities.length > 0) {
    const center = structureEntities[0].position;
    const radius = 50;
    try {
      const [areaTiles, areaStructures, areaArmies] = await Promise.all([
        client.sql.fetchTilesInArea?.(center, radius) ?? Promise.resolve([]),
        client.sql.fetchStructuresInArea?.(center, radius) ?? Promise.resolve([]),
        client.sql.fetchArmiesInArea?.(center, radius) ?? Promise.resolve([]),
      ]);

      if (areaTiles.length > 0) {
        // Build explored set for reuse in explorer direction guidance
        exploredSet = new Set((areaTiles as any[]).map((t: any) => `${t.col},${t.row}`));
        tiles = buildTileVisibility(areaTiles as any);
      }

      // Add non-owned structures from the area (avoid duplicates of our own)
      const ownedEntityIds = new Set(structureEntities.map((e) => e.entityId));
      for (const s of areaStructures) {
        const eid = Number((s as any).entity_id ?? 0);
        if (!ownedEntityIds.has(eid)) {
          nearbyEntities.push({
            type: "structure",
            entityId: eid,
            owner: String((s as any).owner_address ?? "0x0"),
            position: {
              x: Number((s as any).coord_x ?? 0),
              y: Number((s as any).coord_y ?? 0),
            },
            name: (s as any).owner_name || undefined,
            structureType: String((s as any).structure_type ?? "unknown"),
            level: Number((s as any).level ?? 1),
          });
        }
      }

      const ownedArmyIds = new Set(armyEntities.map((e) => e.entityId));
      for (const a of areaArmies) {
        const eid = Number((a as any).entity_id ?? 0);
        if (!ownedArmyIds.has(eid)) {
          const troopCount = (a as any).count ? parseHexOrNum((a as any).count) : 0;
          const tierNum = (a as any).tier ? parseHexOrNum((a as any).tier) : 0;
          nearbyEntities.push({
            type: "army",
            entityId: eid,
            owner: String((a as any).owner_address ?? "0x0"),
            position: {
              x: Number((a as any).coord_x ?? 0),
              y: Number((a as any).coord_y ?? 0),
            },
            strength: troopCount > 0 ? troopCount * tierNum : 0,
            stamina: parseHexOrNum((a as any).stamina_amount),
            isInBattle: false,
            troops: troopCount > 0 ? {
              totalTroops: troopCount,
              slots: [{ troopType: String((a as any).category ?? "unknown"), count: troopCount, tier: tierNum }],
              strength: troopCount * tierNum,
            } : undefined,
          });
        }
      }
    } catch {
      // Bounded queries failed; we still have our own entities
    }
  }

  // Enrich player structures and armies in parallel
  await Promise.all([
    ...structureEntities.map(async (entity) => {
      // Fetch realm detail, resource balances, and buildings concurrently per structure
      const [realmResult, resourceResult, buildingResult] = await Promise.allSettled([
        client.view.realm(entity.entityId),
        client.sql.fetchResourceBalances?.(entity.entityId),
        client.sql.fetchBuildingsByStructure?.(entity.entityId),
      ]);

      if (realmResult.status === "fulfilled" && realmResult.value) {
        const rd = realmResult.value as any;
        if (rd.guard?.slots) {
          entity.guardSlots = rd.guard.slots;
          entity.guardStrength = Number(rd.guard.strength ?? 0);
        }
      } else if (realmResult.status === "rejected") {
        process.stderr.write(`[world-state] realm(${entity.entityId}) failed: ${realmResult.reason}\n`);
      }

      if (resourceResult.status === "fulfilled" && resourceResult.value) {
        entity.resourceBalances = parseResourceRow(resourceResult.value);
      } else if (resourceResult.status === "rejected") {
        process.stderr.write(`[world-state] resources(${entity.entityId}) failed: ${resourceResult.reason}\n`);
      }

      if (buildingResult.status === "fulfilled" && buildingResult.value?.length > 0) {
        entity.buildings = buildingResult.value.map((b: any) => ({
          category: BUILDING_CATEGORY_MAP[Number(b.category)] ?? `Unknown (${b.category})`,
          paused: Boolean(b.paused),
          position: { x: Number(b.inner_col ?? 0), y: Number(b.inner_row ?? 0) },
        }));
      } else if (buildingResult.status === "rejected") {
        process.stderr.write(`[world-state] buildings(${entity.entityId}) failed: ${buildingResult.reason}\n`);
      }
    }),
    ...armyEntities.map(async (entity) => {
      try {
        const explorerDetail = await client.view.explorer(entity.explorerId ?? entity.entityId);
        if (explorerDetail) {
          const ed = explorerDetail as any;
          if (ed.explorerId != null) {
            entity.explorerId = Number(ed.explorerId);
          }
          if (ed.troops) {
            entity.troops = {
              totalTroops: Number(ed.troops.totalTroops ?? 0),
              slots: Array.isArray(ed.troops.slots) ? ed.troops.slots : [],
              strength: Number(ed.troops.strength ?? 0),
            };
          }
          if (Array.isArray(ed.carriedResources)) {
            entity.carriedResources = ed.carriedResources.map((r: any) => ({
              resourceId: Number(r.resourceId ?? 0),
              name: String(r.name ?? ""),
              amount: Number(r.amount ?? r.balance ?? 0),
            }));
          }
          if (ed.stamina != null) {
            entity.stamina = Number(ed.stamina);
          }
          if (ed.isInBattle != null) {
            entity.isInBattle = Boolean(ed.isInBattle);
          }
        }
      } catch (e) {
        process.stderr.write(`[world-state] explorer(${entity.explorerId ?? entity.entityId}) failed: ${e}\n`);
      }
    }),
  ]);

  // Enrich army entities with unexplored direction guidance
  if (exploredSet) {
    for (const entity of armyEntities) {
      entity.unexploredDirections = unexploredDirectionsFrom(
        entity.position.x, entity.position.y, exploredSet,
      );
    }
  }

  const entities: EternumEntity[] = [...structureEntities, ...armyEntities, ...nearbyEntities];

  // Populate resources from the player's totalResources
  const resources = new Map<string, number>();
  if (Array.isArray((playerView as any)?.totalResources)) {
    for (const r of (playerView as any).totalResources) {
      resources.set(r.name, r.totalBalance);
    }
  }

  // Fetch recent events and game config in parallel
  let recentEvents: EternumWorldState["recentEvents"];
  let gameConfig: GameConfig | undefined;

  const [eventsResult, configResult] = await Promise.allSettled([
    client.view.events?.({ owner: accountAddress, limit: 10 }),
    (async () => {
      const [worldRow, levelConfigs, buildingCategories, resourceFactories] = await Promise.all([
        client.sql?.fetchWorldConfig?.(),
        client.sql?.fetchStructureLevelConfig?.(),
        client.sql?.fetchBuildingCategoryConfig?.(),
        client.sql?.fetchResourceFactoryConfig?.(),
      ]);
      if (worldRow) {
        // Resolve resource lists for upgrade costs
        let resourceLists: any[] | undefined;
        if (levelConfigs?.length) {
          const resourceIds = levelConfigs.map((lc) => Number(lc.required_resources_id));
          resourceLists = (await client.sql?.fetchResourceListByIds?.(resourceIds)) ?? undefined;
        }
        return parseGameConfig(worldRow, levelConfigs ?? [], resourceLists, buildingCategories ?? undefined, resourceFactories ?? undefined);
      }
      return undefined;
    })(),
  ]);

  if (eventsResult.status === "fulfilled" && eventsResult.value?.events) {
    recentEvents = eventsResult.value.events.map((e: any) => ({
      eventId: Number(e.eventId ?? 0),
      eventType: String(e.eventType ?? "unknown"),
      timestamp: Number(e.timestamp ?? 0),
      data: e.data ?? {},
    }));
  } else if (eventsResult.status === "rejected") {
    process.stderr.write(`[world-state] events() failed: ${eventsResult.reason}\n`);
  }

  if (configResult.status === "fulfilled") {
    gameConfig = configResult.value;
  } else {
    process.stderr.write(`[world-state] gameConfig fetch failed: ${configResult.reason}\n`);
  }

  // Fetch hyperstructure data from map structures (type = "hyperstructure")
  let hyperstructures: EternumWorldState["hyperstructures"];
  try {
    // Look for hyperstructure-type entities in the nearby structures
    const hsStructures = nearbyEntities.filter(
      (e) => e.type === "structure" && e.structureType === "hyperstructure",
    );
    if (hsStructures.length > 0) {
      hyperstructures = [];
      for (const hs of hsStructures) {
        try {
          const hsView = await client.view.hyperstructure(hs.entityId);
          if (hsView) {
            const hd = hsView as any;
            hyperstructures.push({
              entityId: Number(hd.entityId ?? hs.entityId),
              position: { x: Number(hd.position?.x ?? hs.position.x), y: Number(hd.position?.y ?? hs.position.y) },
              owner: hd.owner ? String(hd.owner) : null,
              progress: Number(hd.progress ?? 0),
              isComplete: Boolean(hd.isComplete ?? false),
            });
          }
        } catch (e) {
          process.stderr.write(`[world-state] hyperstructure(${hs.entityId}) failed: ${e}\n`);
        }
      }
    }
  } catch (e) {
    process.stderr.write(`[world-state] hyperstructure scan failed: ${e}\n`);
  }

  // Collect bank entities from nearby structures
  let banks: EternumWorldState["banks"];
  const bankStructures = nearbyEntities.filter(
    (e) => e.type === "structure" && e.structureType === "bank",
  );
  if (bankStructures.length > 0) {
    banks = bankStructures.map((b) => ({
      entityId: b.entityId,
      position: { x: b.position.x, y: b.position.y },
    }));
  }

  return {
    tick: Math.floor(Date.now() / 1000),
    timestamp: Date.now(),
    entities,
    resources,
    player: {
      address: (playerView as any)?.address ?? accountAddress,
      name: (playerView as any)?.name ?? "",
      structures: playerStructures.length,
      armies: playerArmies.length,
      points: Number((playerView as any)?.points ?? 0),
      rank: Number((playerView as any)?.rank ?? 0),
    },
    market: {
      recentSwapCount: recentSwaps.length,
      openOrderCount: openOrders.length,
    },
    leaderboard: {
      topPlayers: leaderboardEntries.map((e: any) => ({
        name: e.name,
        points: e.points,
        rank: e.rank,
      })),
      totalPlayers: Number((leaderboardView as any)?.totalPlayers ?? 0),
    },
    tiles,
    gameConfig,
    recentEvents,
    hyperstructures,
    banks,
  };
}
