import type { WorldState } from "@bibliothecadao/game-agent";
import type { EternumClient } from "@bibliothecadao/client";
import { computeStrength } from "@bibliothecadao/client";
import { RESOURCE_BALANCE_COLUMNS, TROOP_BALANCE_COLUMNS } from "@bibliothecadao/torii";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * An entity in the Eternum world, representing a structure or army
 * in a unified format suitable for the autonomous agent framework.
 */
export interface EternumEntity {
  type: "structure" | "army";
  entityId: number;
  owner: string;
  ownerName?: string;
  isOwned: boolean;
  position: { x: number; y: number };
  name?: string;

  // Structure-specific
  structureType?: string;
  level?: number;
  guardStrength?: number;
  guardSummary?: string;
  guardSlots?: { slot: string; troops: string }[];
  resources?: Map<string, number>;
  productionBuildings?: string[];
  buildingSlots?: { used: number; total: number; buildings: string[] };
  population?: { current: number; capacity: number };
  nextUpgrade?: { name: string; cost: string } | null; // null = max level
  armies?: { current: number; max: number };
  troopsInReserve?: string[]; // e.g. ["KnightT1: 150", "PaladinT2: 30"]

  // Army-specific
  strength?: number;
  stamina?: number;
  isInBattle?: boolean;
  troopSummary?: string;
  neighborTiles?: { direction: string; dirId: number; explored: boolean; occupied: boolean }[];

  // Owned entities only
  actions?: string[];
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
}

/** Visibility radius (in hexes) around each owned entity. */
const VIEW_RADIUS = 5;

type Pos = { x: number; y: number };

/** Chebyshev distance — true if (x,y) is within `radius` hexes of `center`. */
function withinRadius(pos: Pos, center: Pos, radius: number): boolean {
  return Math.abs(pos.x - center.x) <= radius && Math.abs(pos.y - center.y) <= radius;
}

/** Returns true if `pos` is within VIEW_RADIUS of any position in `centers`. */
function nearAnyOwned(pos: Pos, centers: Pos[]): boolean {
  return centers.some((c) => withinRadius(pos, c, VIEW_RADIUS));
}

// ---------------------------------------------------------------------------
// Helpers for raw SQL data parsing
// ---------------------------------------------------------------------------

const RESOURCE_PRECISION = 1_000_000_000;

/** Parse a hex string to a BigInt, then to number. Returns 0 for null/invalid. */
function parseHexBig(hex: string | null | undefined): bigint {
  if (!hex || hex === "0x0") return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

/** Parse a hex count and divide by RESOURCE_PRECISION to get actual troop count. */
function parseTroopCount(hex: string | null | undefined): number {
  const raw = parseHexBig(hex);
  return Number(raw / BigInt(RESOURCE_PRECISION));
}

/** Parse a hex stamina amount to a number. */
function parseStamina(hex: string | null | undefined): number {
  return Number(parseHexBig(hex));
}

/** Decode a felt252 hex string (e.g. "0x...626f6174") to a human-readable string.
 *  If the input is already a readable string (not hex), pass it through. */
function decodeFelt252(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  // If it's not a hex string, return as-is (already decoded)
  if (!hex.startsWith("0x") && !hex.startsWith("0X")) return hex;
  try {
    const n = BigInt(hex);
    if (n === 0n) return undefined;
    let h = n.toString(16);
    if (h.length % 2 !== 0) h = "0" + h;
    let result = "";
    for (let i = 0; i < h.length; i += 2) {
      const code = parseInt(h.slice(i, i + 2), 16);
      if (code >= 32 && code < 127) result += String.fromCharCode(code);
    }
    return result || undefined;
  } catch {
    return undefined;
  }
}

const STRUCTURE_CATEGORY_NAMES: Record<number, string> = {
  1: "Realm",
  2: "Hyperstructure",
  3: "Bank",
  4: "Mine",
  5: "Village",
};

function structureCategoryName(cat: number): string {
  return STRUCTURE_CATEGORY_NAMES[cat] ?? "Unknown";
}

/** Troop category — DB returns strings like "Knight", "Paladin", "Crossbowman". */
function troopCategoryName(cat: string | null | undefined): string {
  if (!cat) return "Unknown";
  const s = String(cat);
  if (["Knight", "Crossbowman", "Paladin"].includes(s)) return s;
  return s;
}

/** Troop tier — DB returns "T1", "T2", "T3". */
function troopTierLabel(tier: string | null | undefined): string {
  if (!tier) return "T1";
  const s = String(tier);
  if (s.startsWith("T")) return s;
  const t = Number(s);
  if (t === 0) return "T1";
  if (t === 1) return "T2";
  if (t === 2) return "T3";
  return `T${t + 1}`;
}

/** Convert tier label to numeric multiplier for computeStrength. */
function tierToNum(tier: string | null | undefined): number {
  const s = String(tier ?? "T1");
  if (s === "T1") return 1;
  if (s === "T2") return 2;
  if (s === "T3") return 3;
  const t = Number(s);
  return Number.isFinite(t) ? t + 1 : 1;
}

/** Compute total guard strength across alpha/bravo/charlie/delta guard slots. */
function computeGuardStrength(raw: any): number {
  let total = 0;
  for (const slot of ["alpha", "bravo", "charlie", "delta"] as const) {
    const count = parseTroopCount(raw[`${slot}_count`]);
    const tier = tierToNum(raw[`${slot}_tier`]);
    if (count > 0) {
      total += computeStrength(count, tier);
    }
  }
  return total;
}

/** Build a human-readable guard summary like "2900 Knight T1" or "1500 Knight T2 + 1400 Paladin T1". */
function buildGuardSummary(raw: any): string | undefined {
  const parts: string[] = [];
  for (const slot of ["alpha", "bravo", "charlie", "delta"] as const) {
    const count = parseTroopCount(raw[`${slot}_count`]);
    if (count > 0) {
      const cat = troopCategoryName(raw[`${slot}_category`]);
      const tier = troopTierLabel(raw[`${slot}_tier`]);
      parts.push(`${count} ${cat} ${tier}`);
    }
  }
  return parts.length > 0 ? parts.join(" + ") : undefined;
}

/** Build per-slot guard details: [{slot: "Alpha", troops: "2900 Knight T1"}, ...]. */
function buildGuardSlots(raw: any): { slot: string; troops: string }[] {
  const slots: { slot: string; troops: string }[] = [];
  for (const slot of ["alpha", "bravo", "charlie", "delta"] as const) {
    const count = parseTroopCount(raw[`${slot}_count`]);
    const label = slot.charAt(0).toUpperCase() + slot.slice(1);
    if (count > 0) {
      const cat = troopCategoryName(raw[`${slot}_category`]);
      const tier = troopTierLabel(raw[`${slot}_tier`]);
      slots.push({ slot: label, troops: `${count} ${cat} ${tier}` });
    } else {
      slots.push({ slot: label, troops: "empty" });
    }
  }
  return slots;
}

// Max explorer armies per structure type
const MAX_ARMIES: Record<string, number> = {
  Realm: 1,
  Village: 1,
  Hyperstructure: 0,
  Bank: 0,
  Mine: 0,
};

/** Build a human-readable troop summary like "150 Knight T2". */
function buildTroopSummary(raw: any): string | undefined {
  const count = parseTroopCount(raw.count);
  if (count <= 0) return undefined;
  const cat = troopCategoryName(raw.category);
  const tier = troopTierLabel(raw.tier);
  return `${count} ${cat} ${tier}`;
}

/** Format a number for display: 1500 → "1.5K", 2000000 → "2M", etc. */
function fmtNum(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${+(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${+(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${+(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${+(abs / 1e3).toFixed(2)}K`;
  return `${sign}${abs}`;
}

/** Normalize + lowercase address comparison. */
function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Building slot parsing — unpack packed_counts from structure data
// ---------------------------------------------------------------------------

const BUILDING_NAMES: Record<number, string> = {
  1: "WorkersHut",
  3: "Stone",
  4: "Coal",
  5: "Wood",
  6: "Copper",
  7: "Ironwood",
  9: "Gold",
  11: "Mithral",
  13: "ColdIron",
  21: "Adamantine",
  24: "Dragonhide",
  25: "Labor",
  27: "Donkey",
  28: "KnightT1",
  29: "KnightT2",
  30: "KnightT3",
  31: "CrossbowT1",
  32: "CrossbowT2",
  33: "CrossbowT3",
  34: "PaladinT1",
  35: "PaladinT2",
  36: "PaladinT3",
  37: "Wheat",
  38: "Fish",
  39: "Essence",
};

/** Unpack 3 packed u128 hex strings into an array of 48 8-bit building counts. */
function unpackBuildingCountsFromHex(
  hex1: string | null | undefined,
  hex2: string | null | undefined,
  hex3: string | null | undefined,
): number[] {
  const counts: number[] = [];
  for (const hex of [hex1, hex2, hex3]) {
    const val = hex ? parseHexBig(hex) : 0n;
    for (let i = 0; i < 16; i++) {
      counts.push(Number((val >> BigInt(i * 8)) & 0xffn));
    }
  }
  return counts;
}

/** Build building slot summary for a structure. */
function buildBuildingSlots(raw: any): { used: number; total: number; buildings: string[] } {
  const level = Number(raw.level ?? 0);
  // Max slots = 3 * (level+1) * (level+2) — rings 1..(level+1) around center hex
  const total = 3 * (level + 1) * (level + 2);

  const counts = unpackBuildingCountsFromHex(raw.packed_counts_1, raw.packed_counts_2, raw.packed_counts_3);

  let used = 0;
  const buildings: string[] = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      used += counts[i];
      const name = BUILDING_NAMES[i + 1] ?? `Type${i + 1}`;
      buildings.push(`${name} x${counts[i]}`);
    }
  }

  return { used, total, buildings };
}

// Population cost per building category index (1-based).
// WorkersHut=0, Labor=0, resource buildings=2, military/donkey=3, Wheat/Fish=1
const BUILDING_POP_COST: Record<number, number> = {
  1: 0, // WorkersHut
  3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 9: 2, 11: 2, 13: 2, 21: 2, 24: 2, // resources
  25: 0, // Labor
  27: 3, // Donkey
  28: 3, 29: 3, 30: 3, 31: 3, 32: 3, 33: 3, 34: 3, 35: 3, 36: 3, // military
  37: 1, 38: 1, // Wheat, Fish
  39: 2, // Essence
};
const WORKERS_HUT_CAPACITY = 6;
const BASE_POPULATION_CAPACITY = 6;

/** Compute population (current usage, total capacity) from building counts. */
function computePopulation(counts: number[]): { current: number; capacity: number } {
  let current = 0;
  let granted = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      const catId = i + 1;
      current += counts[i] * (BUILDING_POP_COST[catId] ?? 2);
      if (catId === 1) granted += counts[i] * WORKERS_HUT_CAPACITY; // WorkersHut
    }
  }
  return { current, capacity: BASE_POPULATION_CAPACITY + granted };
}

// Realm upgrade levels: 0=Settlement, 1=City, 2=Kingdom, 3=Empire (max)
const REALM_LEVEL_NAMES = ["Settlement", "City", "Kingdom", "Empire"];
const REALM_UPGRADE_COSTS: Record<number, { name: string; cost: string }> = {
  0: { name: "City", cost: "180 Labor, 1200 Wheat, 200 Essence" },
  1: { name: "Kingdom", cost: "360 Labor, 2400 Wheat, 600 Essence, 180 Wood" },
  2: { name: "Empire", cost: "720 Labor, 4800 Wheat, 1200 Essence, 360 Wood, 180 Coal, 180 Copper" },
};

/** Get the next realm upgrade info, or null if already at max level. */
function getNextUpgrade(level: number): { name: string; cost: string } | null {
  return REALM_UPGRADE_COSTS[level] ?? null;
}

// ---------------------------------------------------------------------------
// Hex neighbor calculation — even-r offset coordinates (matches Cairo contract)
// ---------------------------------------------------------------------------

const DIR_NAMES = ["East", "NE", "NW", "West", "SW", "SE"] as const;

/** Compute the 6 hex neighbors of a position using even-r offset coords. */
function hexNeighbors(x: number, y: number): { dir: string; dirId: number; x: number; y: number }[] {
  if (y % 2 === 0) {
    // Even row
    return [
      { dir: "East", dirId: 0, x: x + 1, y },
      { dir: "NE", dirId: 1, x: x + 1, y: y + 1 },
      { dir: "NW", dirId: 2, x, y: y + 1 },
      { dir: "West", dirId: 3, x: x - 1, y },
      { dir: "SW", dirId: 4, x, y: y - 1 },
      { dir: "SE", dirId: 5, x: x + 1, y: y - 1 },
    ];
  }
  // Odd row
  return [
    { dir: "East", dirId: 0, x: x + 1, y },
    { dir: "NE", dirId: 1, x, y: y + 1 },
    { dir: "NW", dirId: 2, x: x - 1, y: y + 1 },
    { dir: "West", dirId: 3, x: x - 1, y },
    { dir: "SW", dirId: 4, x: x - 1, y: y - 1 },
    { dir: "SE", dirId: 5, x, y: y - 1 },
  ];
}

function getStructureActions(structureType: string): string[] {
  const base = ["addGuard", "deleteGuard"];
  switch (structureType) {
    case "Realm":
      return [...base, "createExplorer", "upgradeRealm", "build", "sendResources"];
    case "Hyperstructure":
      return [...base, "contribute"];
    case "Bank":
      return [...base, "buyResources", "sellResources"];
    case "Mine":
    case "Village":
      return base;
    default:
      return base;
  }
}

function getArmyActions(): string[] {
  return ["move", "explore", "travel", "attackExplorer", "attackGuard", "raid"];
}

// ---------------------------------------------------------------------------
// buildWorldState
// ---------------------------------------------------------------------------

/**
 * Build a snapshot of the Eternum world state by querying SQL APIs
 * for rich entity data and the view client for player/market/leaderboard.
 *
 * The map view is the union of VIEW_RADIUS-hex areas around every entity
 * the player owns (structures + armies).
 *
 * @param client - An initialized EternumClient instance
 * @param accountAddress - The player's on-chain address
 * @returns A fully populated EternumWorldState
 */
export async function buildWorldState(client: EternumClient, accountAddress: string): Promise<EternumWorldState> {
  // 1. Fetch all data sources in parallel.
  const [playerView, marketView, leaderboardView, allRawStructures, allRawArmies, allTiles] = await Promise.all([
    client.view.player(accountAddress),
    client.view.market(),
    client.view.leaderboard({ limit: 10 }),
    client.sql.fetchAllStructuresMapData(),
    client.sql.fetchAllArmiesMapData(),
    client.sql.fetchAllTiles().catch(() => [] as any[]),
  ]);

  const rawStructures: any[] = Array.isArray(allRawStructures) ? allRawStructures : [];
  const rawArmies: any[] = Array.isArray(allRawArmies) ? allRawArmies : [];
  const rawTiles: any[] = Array.isArray(allTiles) ? allTiles : [];

  // 2. Collect positions of every entity the player owns (from raw data).
  const ownedPositions: Pos[] = [];

  for (const s of rawStructures) {
    if (sameAddress(s.owner_address, accountAddress)) {
      ownedPositions.push({ x: Number(s.coord_x ?? 0), y: Number(s.coord_y ?? 0) });
    }
  }
  for (const a of rawArmies) {
    if (sameAddress(a.owner_address, accountAddress)) {
      ownedPositions.push({ x: Number(a.coord_x ?? 0), y: Number(a.coord_y ?? 0) });
    }
  }

  // 3. Filter to entities within VIEW_RADIUS of any owned position.
  const nearbyRawStructures = rawStructures.filter((s) =>
    nearAnyOwned({ x: Number(s.coord_x ?? 0), y: Number(s.coord_y ?? 0) }, ownedPositions),
  );
  const nearbyRawArmies = rawArmies.filter((a) =>
    nearAnyOwned({ x: Number(a.coord_x ?? 0), y: Number(a.coord_y ?? 0) }, ownedPositions),
  );

  // 4. Build enriched structure entities.
  const structureEntities: EternumEntity[] = nearbyRawStructures.map((s: any) => {
    const owned = sameAddress(s.owner_address, accountAddress);
    const stType = structureCategoryName(Number(s.structure_type));
    const level = Number(s.level ?? 0);

    // Compute building slots and population for owned structures
    let buildingSlots: EternumEntity["buildingSlots"];
    let population: EternumEntity["population"];
    if (owned) {
      const counts = unpackBuildingCountsFromHex(s.packed_counts_1, s.packed_counts_2, s.packed_counts_3);
      const total = 3 * (level + 1) * (level + 2);
      let used = 0;
      const buildings: string[] = [];
      for (let i = 0; i < counts.length; i++) {
        if (counts[i] > 0) {
          used += counts[i];
          const name = BUILDING_NAMES[i + 1] ?? `Type${i + 1}`;
          buildings.push(`${name} x${counts[i]}`);
        }
      }
      buildingSlots = { used, total, buildings };
      population = computePopulation(counts);
    }

    return {
      type: "structure" as const,
      entityId: Number(s.entity_id ?? 0),
      owner: String(s.owner_address ?? ""),
      ownerName: decodeFelt252(s.owner_name),
      isOwned: owned,
      position: { x: Number(s.coord_x ?? 0), y: Number(s.coord_y ?? 0) },
      structureType: stType,
      level,
      guardStrength: computeGuardStrength(s),
      guardSummary: buildGuardSummary(s),
      guardSlots: owned ? buildGuardSlots(s) : undefined,
      buildingSlots,
      population,
      nextUpgrade: owned && stType === "Realm" ? getNextUpgrade(level) : undefined,
      armies: owned ? { current: 0, max: MAX_ARMIES[stType] ?? 0 } : undefined, // current filled below
      actions: owned ? getStructureActions(stType) : undefined,
    };
  });

  // 5. Build enriched army entities.
  const armyEntities: EternumEntity[] = nearbyRawArmies.map((a: any) => {
    const owned = sameAddress(a.owner_address, accountAddress);
    const count = parseTroopCount(a.count);
    const tier = tierToNum(a.tier);
    return {
      type: "army" as const,
      entityId: Number(a.entity_id ?? 0),
      owner: String(a.owner_address ?? ""),
      ownerName: decodeFelt252(a.owner_name),
      isOwned: owned,
      position: { x: Number(a.coord_x ?? 0), y: Number(a.coord_y ?? 0) },
      strength: count > 0 ? computeStrength(count, tier) : 0,
      stamina: parseStamina(a.stamina_amount),
      isInBattle: Number(a.battle_cooldown_end ?? 0) > 0,
      troopSummary: buildTroopSummary(a),
      actions: owned ? getArmyActions() : undefined,
    };
  });

  // 5a. Count armies per owned structure using owner_structure_id from ALL raw armies.
  for (const a of rawArmies) {
    const structId = Number(a.owner_structure_id ?? 0);
    if (structId > 0) {
      const struct = structureEntities.find((e) => e.entityId === structId && e.isOwned);
      if (struct?.armies) {
        struct.armies.current++;
      }
    }
  }

  // 5b. Build exploration map and per-army neighbor tiles.
  //     Tile biome > 0 means explored; biome 0 or missing means unexplored.
  const exploredTiles = new Set<string>();
  for (const t of rawTiles) {
    const col = Number(t.col ?? t.x ?? 0);
    const row = Number(t.row ?? t.y ?? 0);
    const biome = Number(t.biome ?? 0);
    if (biome > 0) {
      exploredTiles.add(`${col},${row}`);
    }
  }

  // Build a set of occupied tile coords (structures + armies) for army pathfinding.
  const occupiedTiles = new Set<string>();
  for (const s of nearbyRawStructures) {
    occupiedTiles.add(`${Number(s.coord_x ?? 0)},${Number(s.coord_y ?? 0)}`);
  }
  for (const a of nearbyRawArmies) {
    occupiedTiles.add(`${Number(a.coord_x ?? 0)},${Number(a.coord_y ?? 0)}`);
  }

  // For each owned army, compute neighbor tile exploration + occupation status.
  for (const army of armyEntities) {
    if (!army.isOwned) continue;
    const neighbors = hexNeighbors(army.position.x, army.position.y);
    army.neighborTiles = neighbors.map((n) => ({
      direction: n.dir,
      dirId: n.dirId,
      explored: exploredTiles.has(`${n.x},${n.y}`),
      occupied: occupiedTiles.has(`${n.x},${n.y}`),
    }));
  }

  const entities: EternumEntity[] = [...structureEntities, ...armyEntities];

  // 6. Fetch per-structure resources and production buildings from SQL.
  const ownedEntityIds = structureEntities.filter((e) => e.isOwned).map((e) => e.entityId);
  const resources = new Map<string, number>();
  if (ownedEntityIds.length > 0) {
    try {
      const balanceRows: any[] = await client.sql.fetchResourceBalancesAndProduction(ownedEntityIds);
      for (const row of balanceRows) {
        const entityId = Number(row.entity_id);
        const entity = structureEntities.find((e) => e.entityId === entityId && e.isOwned);
        if (!entity) continue;

        const entityResources = new Map<string, number>();
        const buildings: string[] = [];

        for (const col of RESOURCE_BALANCE_COLUMNS) {
          // Parse balance
          const hexVal = row[col.column];
          if (hexVal && hexVal !== "0x0") {
            const amount = Number(parseHexBig(hexVal) / BigInt(RESOURCE_PRECISION));
            if (amount > 0) {
              entityResources.set(col.name, amount);
              resources.set(col.name, (resources.get(col.name) ?? 0) + amount);
            }
          }
          // Parse production building count
          const prodCol = `${col.column.replace("_BALANCE", "_PRODUCTION")}.building_count`;
          const buildingCount = Number(row[prodCol] ?? 0);
          if (buildingCount > 0) {
            buildings.push(`${col.name} x${buildingCount}`);
          }
        }

        // Parse troop reserve balances
        const troopReserves: string[] = [];
        for (const col of TROOP_BALANCE_COLUMNS) {
          const hexVal = row[col.column];
          if (hexVal && hexVal !== "0x0") {
            const amount = Number(parseHexBig(hexVal) / BigInt(RESOURCE_PRECISION));
            if (amount > 0) {
              troopReserves.push(`${col.name}: ${amount}`);
            }
          }
        }

        entity.resources = entityResources;
        entity.productionBuildings = buildings.length > 0 ? buildings : undefined;
        entity.troopsInReserve = troopReserves.length > 0 ? troopReserves : undefined;
      }
    } catch (err) {
      console.error("Failed to fetch resource balances:", err);
    }
  }

  const playerStructures = Array.isArray((playerView as any)?.structures) ? (playerView as any).structures : [];
  const playerArmies = Array.isArray((playerView as any)?.armies) ? (playerView as any).armies : [];
  const recentSwaps = Array.isArray((marketView as any)?.recentSwaps) ? (marketView as any).recentSwaps : [];
  const openOrders = Array.isArray((marketView as any)?.openOrders) ? (marketView as any).openOrders : [];
  const leaderboardEntries = Array.isArray((leaderboardView as any)?.entries) ? (leaderboardView as any).entries : [];

  // --- DEBUG LOG ---
  try {
    const debugPath = join(process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"), "debug-world-state.log");
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    const lines: string[] = [
      `\n========== ${ts} ==========`,
      `accountAddress: ${accountAddress}`,
      ``,
      `--- RAW SQL: ${rawStructures.length} structures, ${rawArmies.length} armies ---`,
      ``,
      `ALL unique owner_addresses in structures:`,
      ...Array.from(new Set(rawStructures.map((s: any) => s.owner_address))).map((addr: any) => `  ${addr}`),
      ``,
      `ALL structures from SQL (first 10):`,
      ...rawStructures.slice(0, 10).map((s: any, i: number) =>
        `  [${i}] entity_id=${s.entity_id} owner_address=${s.owner_address} owner_name=${s.owner_name} coord=(${s.coord_x},${s.coord_y}) type=${s.structure_type} level=${s.level}`
      ),
      ``,
      `Ownership matches (sameAddress with ${accountAddress}):`,
      ...rawStructures
        .filter((s: any) => sameAddress(s.owner_address, accountAddress))
        .map((s: any) => `  OWNED: entity_id=${s.entity_id} owner=${s.owner_address} coord=(${s.coord_x},${s.coord_y})`),
      ...(rawStructures.filter((s: any) => sameAddress(s.owner_address, accountAddress)).length === 0
        ? [`  ** NO STRUCTURES MATCHED **`]
        : []),
      ``,
      `ALL armies from SQL (first 10):`,
      ...rawArmies.slice(0, 10).map((a: any, i: number) =>
        `  [${i}] entity_id=${a.entity_id} owner_address=${a.owner_address} owner_name=${a.owner_name} coord=(${a.coord_x},${a.coord_y}) count=${a.count} tier=${a.tier}`
      ),
      ``,
      `Owned army matches:`,
      ...rawArmies
        .filter((a: any) => sameAddress(a.owner_address, accountAddress))
        .map((a: any) => `  OWNED: entity_id=${a.entity_id} owner=${a.owner_address}`),
      ...(rawArmies.filter((a: any) => sameAddress(a.owner_address, accountAddress)).length === 0
        ? [`  ** NO ARMIES MATCHED **`]
        : []),
      ``,
      `ownedPositions: ${JSON.stringify(ownedPositions)}`,
      `nearby structures: ${nearbyRawStructures.length}, nearby armies: ${nearbyRawArmies.length}`,
      `final entities: ${entities.length} (${structureEntities.length} structures, ${armyEntities.length} armies)`,
      ``,
      `--- PLAYER VIEW ---`,
      `playerView keys: ${Object.keys(playerView || {}).join(", ")}`,
      `player name: ${(playerView as any)?.name}`,
      `player structures count: ${playerStructures.length}`,
      `player structures detail: ${JSON.stringify(playerStructures.slice(0, 5), null, 2)}`,
      `player armies count: ${playerArmies.length}`,
      `ownedEntityIds for resources: [${ownedEntityIds.join(", ")}]`,
      `resources total (from SQL): ${resources.size}`,
      ...(resources.size > 0 ? Array.from(resources.entries()).map(([k, v]) => `  ${k}: ${v}`) : [`  (none)`]),
      `per-structure resources:`,
      ...structureEntities.filter((e) => e.isOwned).map((e) =>
        `  id=${e.entityId}: ${e.resources ? Array.from(e.resources.entries()).map(([k, v]) => `${k}=${v}`).join(", ") : "(none)"} | buildings: ${e.productionBuildings?.join(", ") ?? "(none)"}`
      ),
    ];
    writeFileSync(debugPath, lines.join("\n") + "\n", { flag: "a" });
  } catch (_) {
    // don't let debug logging break the agent
  }
  // --- END DEBUG LOG ---

  return {
    tick: Math.floor(Date.now() / 1000),
    timestamp: Date.now(),
    entities,
    resources,
    player: {
      address: (playerView as any)?.address ?? accountAddress,
      name: (playerView as any)?.name ?? "",
      // Use SQL-derived entity counts — playerView.armies is unreliable (often empty)
      structures: structureEntities.filter((e) => e.isOwned).length,
      armies: armyEntities.filter((e) => e.isOwned).length,
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
  };
}

// ---------------------------------------------------------------------------
// Tick prompt formatter — human-readable world state for the agent
// ---------------------------------------------------------------------------

function formatEntityLine(e: EternumEntity): string {
  if (e.type === "structure") {
    const guard = e.guardSummary
      ? ` | guard: ${fmtNum(e.guardStrength ?? 0)} [${e.guardSummary}]`
      : e.guardStrength
        ? ` | guard: ${fmtNum(e.guardStrength)}`
        : "";
    const owner = e.isOwned ? "MINE" : e.ownerName || shortAddr(e.owner);
    const acts = e.actions ? ` | actions: ${e.actions.join(", ")}` : "";
    const lvlName = REALM_LEVEL_NAMES[e.level ?? 0] ?? `L${e.level}`;
    return `  [${e.structureType ?? "?"}] id=${e.entityId} lvl=${e.level ?? 0}(${lvlName}) owner=${owner} pos=(${e.position.x},${e.position.y})${guard}${acts}`;
  }
  // army
  const owner = e.isOwned ? "MINE" : e.ownerName || shortAddr(e.owner);
  const troops = e.troopSummary ?? "no troops";
  const battle = e.isInBattle ? " IN BATTLE" : "";
  const acts = e.actions ? ` | actions: ${e.actions.join(", ")}` : "";
  return `  [Army] id=${e.entityId} ${troops} str=${fmtNum(e.strength ?? 0)} stam=${fmtNum(e.stamina ?? 0)} owner=${owner} pos=(${e.position.x},${e.position.y})${battle}${acts}`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/**
 * Format the full world state into a clear, actionable prompt for the agent.
 * This replaces the generic "Entities: N" with a detailed breakdown.
 */
export function formatEternumTickPrompt(state: EternumWorldState): string {
  const sections: string[] = [];

  // Header
  sections.push(`## Tick ${state.tick} - World State`);

  // Player summary
  const p = state.player;
  const playerName = decodeFelt252(p.name) || p.name || "Unknown";
  sections.push(
    `### You: ${playerName} (rank ${p.rank}, ${p.points} pts)\nStructures: ${p.structures} | Armies: ${p.armies}`,
  );

  // Resources (total across all structures)
  if (state.resources && state.resources.size > 0) {
    const resList = Array.from(state.resources.entries())
      .map(([k, v]) => `  ${k}: ${fmtNum(v)}`)
      .join("\n");
    sections.push(`### Resources (total)\n${resList}`);
  } else {
    sections.push("### Resources (total)\n  None");
  }

  // My entities — with per-structure resources and production buildings
  const myStructures = state.entities.filter((e) => e.isOwned && e.type === "structure");
  const myArmies = state.entities.filter((e) => e.isOwned && e.type === "army");
  const enemyStructures = state.entities.filter((e) => !e.isOwned && e.type === "structure");
  const enemyArmies = state.entities.filter((e) => !e.isOwned && e.type === "army");

  if (myStructures.length > 0 || myArmies.length > 0) {
    const lines = ["### My Entities"];
    if (myStructures.length > 0) {
      lines.push("Structures:");
      for (const e of myStructures) {
        lines.push(formatEntityLine(e));
        // Per-structure resources
        if (e.resources && e.resources.size > 0) {
          const resParts = Array.from(e.resources.entries()).map(([k, v]) => `${k}: ${fmtNum(v)}`);
          lines.push(`    Resources: ${resParts.join(", ")}`);
        }
        // Per-structure production buildings
        if (e.productionBuildings && e.productionBuildings.length > 0) {
          lines.push(`    Buildings: ${e.productionBuildings.join(", ")}`);
        }
        // Building slots
        if (e.buildingSlots) {
          const { used, total, buildings } = e.buildingSlots;
          const free = total - used;
          lines.push(`    Slots: ${used}/${total} used (${free} free)${buildings.length > 0 ? ` — ${buildings.join(", ")}` : ""}`);
        }
        // Population
        if (e.population) {
          const { current, capacity } = e.population;
          lines.push(`    Population: ${current}/${capacity}${current >= capacity ? " FULL — build WorkersHut for +6 capacity" : ""}`);
        }
        // Next realm upgrade
        if (e.nextUpgrade) {
          lines.push(`    Next upgrade → ${e.nextUpgrade.name}: ${e.nextUpgrade.cost}`);
        } else if (e.nextUpgrade === null) {
          lines.push(`    Level: MAX (Empire)`);
        }
        // Armies
        if (e.armies) {
          lines.push(`    Armies: ${e.armies.current}/${e.armies.max}`);
        }
        // Guard slots
        if (e.guardSlots) {
          const slotParts = e.guardSlots.map((s) => `${s.slot}: ${s.troops}`);
          lines.push(`    Guard slots: ${slotParts.join(" | ")}`);
        }
        // Troop reserves
        if (e.troopsInReserve && e.troopsInReserve.length > 0) {
          lines.push(`    Troop reserves: ${e.troopsInReserve.join(", ")}`);
        }
      }
    }
    if (myArmies.length > 0) {
      lines.push("Armies:");
      for (const e of myArmies) {
        lines.push(formatEntityLine(e));
        // Show neighbor tile exploration/occupation for owned armies
        if (e.neighborTiles && e.neighborTiles.length > 0) {
          const explored = e.neighborTiles
            .filter((n) => n.explored && !n.occupied)
            .map((n) => `${n.dirId}:${n.direction}`)
            .join(", ");
          const unexplored = e.neighborTiles
            .filter((n) => !n.explored)
            .map((n) => `${n.dirId}:${n.direction}`)
            .join(", ");
          const blocked = e.neighborTiles
            .filter((n) => n.occupied)
            .map((n) => `${n.dirId}:${n.direction}`)
            .join(", ");
          const parts: string[] = [];
          if (explored) parts.push(`move:[${explored}]`);
          if (unexplored) parts.push(`explore:[${unexplored}]`);
          if (blocked) parts.push(`occupied:[${blocked}]`);
          lines.push(`    Tiles: ${parts.join(" | ")}`);
        }
      }
    }
    sections.push(lines.join("\n"));
  } else {
    sections.push("### My Entities\n  None visible");
  }

  // Nearby entities (not mine)
  if (enemyStructures.length > 0 || enemyArmies.length > 0) {
    const lines = ["### Nearby (other players)"];
    if (enemyStructures.length > 0) {
      lines.push("Structures:");
      for (const e of enemyStructures) lines.push(formatEntityLine(e));
    }
    if (enemyArmies.length > 0) {
      lines.push("Armies:");
      for (const e of enemyArmies) lines.push(formatEntityLine(e));
    }
    sections.push(lines.join("\n"));
  }

  // Leaderboard
  if (state.leaderboard.topPlayers.length > 0) {
    const lb = state.leaderboard.topPlayers
      .map((p, i) => `  ${i + 1}. ${decodeFelt252(p.name) || p.name}: ${p.points} pts`)
      .join("\n");
    sections.push(`### Leaderboard (${state.leaderboard.totalPlayers} players)\n${lb}`);
  }

  // Market
  if (state.market.recentSwapCount > 0 || state.market.openOrderCount > 0) {
    sections.push(
      `### Market\n  Recent swaps: ${state.market.recentSwapCount} | Open orders: ${state.market.openOrderCount}`,
    );
  }

  // Instructions
  sections.push(`### Actions
1. Review your entities above — actions listed per entity show what you can do
2. Use \`execute_action\` to act (use \`list_actions\` to look up params)
3. Use \`observe_game\` only if you need raw detail not shown above
4. Update your task files and reflection as needed`);

  const result = sections.join("\n\n");

  // --- DEBUG: log the tick prompt the agent receives ---
  try {
    const debugPath = join(process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"), "debug-tick-prompt.log");
    const ts = new Date().toISOString();
    writeFileSync(debugPath, `\n========== ${ts} ==========\n${result}\n`, { flag: "a" });
  } catch (_) {}
  // --- END DEBUG ---

  return result;
}
