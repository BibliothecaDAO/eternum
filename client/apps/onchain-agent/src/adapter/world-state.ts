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

  // If we have structures, also query the map area around the first one to see neighbors
  let nearbyEntities: EternumEntity[] = [];
  if (structureEntities.length > 0) {
    const center = structureEntities[0].position;
    try {
      const mapAreaView = await client.view.mapArea({ x: center.x, y: center.y, radius: 50 });
      const mapStructures = Array.isArray((mapAreaView as any)?.structures) ? (mapAreaView as any).structures : [];
      const mapArmies = Array.isArray((mapAreaView as any)?.armies) ? (mapAreaView as any).armies : [];

      // Add non-owned structures from the map (avoid duplicates of our own)
      const ownedEntityIds = new Set(structureEntities.map((e) => e.entityId));
      for (const s of mapStructures) {
        const eid = Number(s.entityId ?? s.entity_id ?? 0);
        if (!ownedEntityIds.has(eid)) {
          nearbyEntities.push({
            type: "structure",
            entityId: eid,
            owner: String(s.owner ?? "0x0"),
            position: {
              x: Number(s.position?.x ?? s.coord_x ?? s.x ?? 0),
              y: Number(s.position?.y ?? s.coord_y ?? s.y ?? 0),
            },
            name: s.name || undefined,
            structureType: String(s.structureType ?? s.category ?? "unknown"),
            level: Number(s.level ?? 1),
          });
        }
      }

      const ownedArmyIds = new Set(armyEntities.map((e) => e.entityId));
      for (const a of mapArmies) {
        const eid = Number(a.entityId ?? a.entity_id ?? 0);
        if (!ownedArmyIds.has(eid)) {
          nearbyEntities.push({
            type: "army",
            entityId: eid,
            owner: String(a.owner ?? "0x0"),
            position: {
              x: Number(a.position?.x ?? a.coord_x ?? a.x ?? 0),
              y: Number(a.position?.y ?? a.coord_y ?? a.y ?? 0),
            },
            strength: Number(a.strength ?? 0),
            stamina: Number(a.stamina ?? 0),
            isInBattle: Boolean(a.isInBattle ?? a.is_in_battle ?? false),
          });
        }
      }
    } catch {
      // Map area query failed; we still have our own entities
    }
  }

  // Enrich player structures with realm detail (guards), resource balances, and buildings
  for (const entity of structureEntities) {
    try {
      const realmDetail = await client.view.realm(entity.entityId);
      if (realmDetail) {
        const rd = realmDetail as any;
        if (rd.guard?.slots) {
          entity.guardSlots = rd.guard.slots;
          entity.guardStrength = Number(rd.guard.strength ?? 0);
        }
      }
    } catch (e) {
      process.stderr.write(`[world-state] realm(${entity.entityId}) failed: ${e}\n`);
    }

    // Fetch resource balances from s1_eternum-Resource table
    try {
      const resourceRow = await client.sql.fetchResourceBalances?.(entity.entityId);
      if (resourceRow) {
        entity.resourceBalances = parseResourceRow(resourceRow);
      }
    } catch (e) {
      process.stderr.write(`[world-state] resources(${entity.entityId}) failed: ${e}\n`);
    }

    // Fetch buildings from s1_eternum-Building table
    try {
      const buildingRows = await client.sql.fetchBuildingsByStructure?.(entity.entityId);
      if (buildingRows && buildingRows.length > 0) {
        entity.buildings = buildingRows.map((b: any) => ({
          category: BUILDING_CATEGORY_MAP[Number(b.category)] ?? `Unknown (${b.category})`,
          paused: Boolean(b.paused),
          position: { x: Number(b.inner_col ?? 0), y: Number(b.inner_row ?? 0) },
        }));
      }
    } catch (e) {
      process.stderr.write(`[world-state] buildings(${entity.entityId}) failed: ${e}\n`);
    }
  }

  // Enrich player armies with explorer detail (troops, carried resources, stamina)
  for (const entity of armyEntities) {
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
  }

  const entities: EternumEntity[] = [...structureEntities, ...armyEntities, ...nearbyEntities];

  // Populate resources from the player's totalResources
  const resources = new Map<string, number>();
  if (Array.isArray((playerView as any)?.totalResources)) {
    for (const r of (playerView as any).totalResources) {
      resources.set(r.name, r.totalBalance);
    }
  }

  // Fetch recent events (limit 10)
  let recentEvents: EternumWorldState["recentEvents"];
  try {
    const eventsView = await client.view.events({ owner: accountAddress, limit: 10 });
    if (eventsView?.events) {
      recentEvents = eventsView.events.map((e: any) => ({
        eventId: Number(e.eventId ?? 0),
        eventType: String(e.eventType ?? "unknown"),
        timestamp: Number(e.timestamp ?? 0),
        data: e.data ?? {},
      }));
    }
  } catch (e) {
    process.stderr.write(`[world-state] events() failed: ${e}\n`);
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
    recentEvents,
    hyperstructures,
    banks,
  };
}
