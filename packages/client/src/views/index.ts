import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { ClientLogger } from "../config";
import type { ExplorerInfo, GuardInfo, ResourceInfo, StructureInfo, TileState } from "../types/common";
import type { MapAreaView } from "../types/views";

/** Category number → human-readable name. */
const STRUCTURE_CATEGORY: Record<number, string> = {
  1: "Realm",
  2: "Hyperstructure",
  3: "Bank",
  4: "FragmentMine",
  5: "Village",
};

/** On-chain troop category: numeric (0=Knight,1=Paladin,2=Crossbowman) or string. */
const TROOP_TYPE: Record<string | number, string> = {
  0: "Knight",
  1: "Paladin",
  2: "Crossbowman",
  Knight: "Knight",
  Paladin: "Paladin",
  Crossbowman: "Crossbowman",
};

/** On-chain troop tier: numeric (0=T1,1=T2,2=T3) or string. */
const TROOP_TIER: Record<string | number, string> = {
  0: "T1",
  1: "T2",
  2: "T3",
  T1: "T1",
  T2: "T2",
  T3: "T3",
};

/** Parse a value that may be a hex string, number, or display name. Returns the raw value for lookup. */
function parseEnumValue(val: any): string | number {
  if (typeof val === "number") return val;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") {
    if (val.startsWith("0x")) return Number(BigInt(val));
    const n = Number(val);
    if (!isNaN(n)) return n;
    return val; // Already a display name like "Knight" or "T1"
  }
  return -1;
}

const GUARD_SLOT_NAMES = ["Alpha", "Bravo", "Charlie", "Delta"];

/**
 * Minimal SqlApi interface describing only the methods ViewClient actually calls.
 * Each method mirrors the corresponding SqlApi method in @bibliothecadao/torii.
 */
export interface SqlApiLike {
  fetchAllTiles(): Promise<any[]>;
  fetchStructureByCoord(coordX: number, coordY: number): Promise<any | null>;
  fetchGuardsByStructure(entityId: number): Promise<any[]>;
  fetchResourceBalances(entityIds: number[]): Promise<any[]>;
  fetchExplorerById(entityId: number): Promise<any | null>;
  fetchExplorersByIds?(entityIds: number[]): Promise<any[]>;
  fetchStructuresByEntityIds?(entityIds: number[]): Promise<any[]>;
}

/**
 * Parse a hex balance string (e.g. "0x00000000746a528800") to a scaled number.
 * Returns 0 for null/empty/invalid.
 */
function parseBalance(hex: string | null | undefined): number {
  if (!hex || hex === "0x0" || hex === "0x") return 0;
  try {
    return Number(BigInt(hex)) / RESOURCE_PRECISION;
  } catch {
    return 0;
  }
}

/** Known resource balance columns → display name. */
const BALANCE_COLUMNS: ReadonlyArray<{ column: string; name: string }> = [
  { column: "STONE_BALANCE", name: "Stone" },
  { column: "COAL_BALANCE", name: "Coal" },
  { column: "WOOD_BALANCE", name: "Wood" },
  { column: "COPPER_BALANCE", name: "Copper" },
  { column: "IRONWOOD_BALANCE", name: "Ironwood" },
  { column: "OBSIDIAN_BALANCE", name: "Obsidian" },
  { column: "GOLD_BALANCE", name: "Gold" },
  { column: "SILVER_BALANCE", name: "Silver" },
  { column: "MITHRAL_BALANCE", name: "Mithral" },
  { column: "ALCHEMICAL_SILVER_BALANCE", name: "Alchemical Silver" },
  { column: "COLD_IRON_BALANCE", name: "Cold Iron" },
  { column: "DEEP_CRYSTAL_BALANCE", name: "Deep Crystal" },
  { column: "RUBY_BALANCE", name: "Ruby" },
  { column: "DIAMONDS_BALANCE", name: "Diamonds" },
  { column: "HARTWOOD_BALANCE", name: "Hartwood" },
  { column: "IGNIUM_BALANCE", name: "Ignium" },
  { column: "TWILIGHT_QUARTZ_BALANCE", name: "Twilight Quartz" },
  { column: "TRUE_ICE_BALANCE", name: "True Ice" },
  { column: "ADAMANTINE_BALANCE", name: "Adamantine" },
  { column: "SAPPHIRE_BALANCE", name: "Sapphire" },
  { column: "ETHEREAL_SILICA_BALANCE", name: "Ethereal Silica" },
  { column: "DRAGONHIDE_BALANCE", name: "Dragonhide" },
  { column: "LABOR_BALANCE", name: "Labor" },
  { column: "EARTHEN_SHARD_BALANCE", name: "Ancient Fragment" },
  { column: "DONKEY_BALANCE", name: "Donkey" },
  { column: "WHEAT_BALANCE", name: "Wheat" },
  { column: "FISH_BALANCE", name: "Fish" },
  { column: "LORDS_BALANCE", name: "Lords" },
  { column: "ESSENCE_BALANCE", name: "Essence" },
  // Troop reserves
  { column: "KNIGHT_T1_BALANCE", name: "Knight T1" },
  { column: "KNIGHT_T2_BALANCE", name: "Knight T2" },
  { column: "KNIGHT_T3_BALANCE", name: "Knight T3" },
  { column: "CROSSBOWMAN_T1_BALANCE", name: "Crossbowman T1" },
  { column: "CROSSBOWMAN_T2_BALANCE", name: "Crossbowman T2" },
  { column: "CROSSBOWMAN_T3_BALANCE", name: "Crossbowman T3" },
  { column: "PALADIN_T1_BALANCE", name: "Paladin T1" },
  { column: "PALADIN_T2_BALANCE", name: "Paladin T2" },
  { column: "PALADIN_T3_BALANCE", name: "Paladin T3" },
];

/**
 * ViewClient provides high-level read methods for Eternum game state.
 */
export class ViewClient {
  constructor(
    private sql: SqlApiLike,
    private logger: ClientLogger = console,
  ) {}

  async mapArea(opts: { x: number; y: number; radius: number }): Promise<MapAreaView> {
    try {
      const allTiles = await this.sql.fetchAllTiles();

      const tiles: TileState[] = allTiles.map((t: any) => ({
        position: { x: Number(t.col), y: Number(t.row) },
        biome: Number(t.biome),
        occupierId: Number(t.occupier_id ?? 0),
        occupierType: Number(t.occupier_type ?? 0),
        occupierIsStructure: Boolean(t.occupier_is_structure),
        rewardExtracted: Boolean(t.reward_extracted),
      }));

      return { center: { x: opts.x, y: opts.y }, radius: opts.radius, tiles };
    } catch (error) {
      this.logger.warn(`[ViewClient] mapArea query failed; returning fallback`, { error, context: opts });
      return { center: { x: opts.x, y: opts.y }, radius: opts.radius, tiles: [] };
    }
  }

  /**
   * Fetch structure details at a coordinate, including guards and resources.
   * Returns null if no structure exists at that position.
   */
  async structureAt(x: number, y: number): Promise<StructureInfo | null> {
    try {
      const structure = await this.sql.fetchStructureByCoord(x, y);
      if (!structure) return null;

      const entityId = Number(structure.entity_id);

      // Fetch guards and resources in parallel
      const [guards, resourceRows] = await Promise.all([
        this.sql.fetchGuardsByStructure(entityId),
        this.sql.fetchResourceBalances([entityId]),
      ]);

      return {
        entityId,
        category: STRUCTURE_CATEGORY[Number(structure.structure_category)] ?? "Unknown",
        level: Number(structure.structure_level),
        realmId: Number(structure.realm_id),
        ownerAddress: String(structure.occupier_id ?? ""),
        position: { x: Number(structure.coord_x), y: Number(structure.coord_y) },
        guards: this.parseGuards(guards),
        resources: this.parseResources(resourceRows[0]),
        explorerCount: Number(structure.troop_explorer_count ?? 0),
        maxExplorerCount: Number(structure.troop_max_explorer_count ?? 0),
      };
    } catch (error) {
      this.logger.warn(`[ViewClient] structureAt query failed`, { error, x, y });
      return null;
    }
  }

  /**
   * Fetch explorer details by entity ID.
   * Returns null if the explorer doesn't exist.
   */
  async explorerInfo(entityId: number): Promise<ExplorerInfo | null> {
    try {
      const data = await this.sql.fetchExplorerById(entityId);
      if (!data) return null;

      return {
        entityId: Number(data.explorer_id),
        ownerName: data.owner_name ?? null,
        ownerAddress: data.owner_address ?? null,
        troopType: TROOP_TYPE[parseEnumValue(data.troop_category)] ?? "Unknown",
        troopTier: TROOP_TIER[parseEnumValue(data.troop_tier)] ?? "Unknown",
        troopCount: parseBalance(data.troop_count),
        stamina: Number(data.max_stamina ?? 0),
        staminaUpdatedTick: Number(data.last_refill_tick ?? 0),
        position: { x: Number(data.coord_x), y: Number(data.coord_y) },
      };
    } catch (error) {
      this.logger.warn(`[ViewClient] explorerInfo query failed`, { error, entityId });
      return null;
    }
  }

  /**
   * Fetch multiple explorer details in a single SQL query.
   */
  async explorerInfoBatch(entityIds: number[]): Promise<Map<number, ExplorerInfo>> {
    const result = new Map<number, ExplorerInfo>();
    if (entityIds.length === 0) return result;
    try {
      if (!this.sql.fetchExplorersByIds) return result;
      const rows = await this.sql.fetchExplorersByIds(entityIds);
      for (const data of rows) {
        const info: ExplorerInfo = {
          entityId: Number(data.explorer_id),
          ownerName: data.owner_name ?? null,
          ownerAddress: data.owner_address ?? null,
          troopType: TROOP_TYPE[parseEnumValue(data.troop_category)] ?? "Unknown",
          troopTier: TROOP_TIER[parseEnumValue(data.troop_tier)] ?? "Unknown",
          troopCount: parseBalance(data.troop_count),
          stamina: Number(data.max_stamina ?? 0),
          staminaUpdatedTick: Number(data.last_refill_tick ?? 0),
          position: { x: Number(data.coord_x), y: Number(data.coord_y) },
        };
        result.set(info.entityId, info);
      }
    } catch (error) {
      this.logger.warn(`[ViewClient] explorerInfoBatch query failed`, { error });
    }
    return result;
  }

  /**
   * Fetch multiple structure details in a single SQL query (includes guards, no resources).
   * Resources are omitted since they require a separate per-structure balance query.
   */
  async structureInfoBatch(entityIds: number[]): Promise<Map<number, StructureInfo>> {
    const result = new Map<number, StructureInfo>();
    if (entityIds.length === 0) return result;
    try {
      if (!this.sql.fetchStructuresByEntityIds) return result;
      const rows = await this.sql.fetchStructuresByEntityIds(entityIds);
      for (const s of rows) {
        const entityId = Number(s.entity_id);
        const guards: GuardInfo[] = [];
        const SLOTS = [
          { prefix: "alpha", name: "Alpha" },
          { prefix: "bravo", name: "Bravo" },
          { prefix: "charlie", name: "Charlie" },
          { prefix: "delta", name: "Delta" },
        ];
        for (const slot of SLOTS) {
          const rawCount = s[`${slot.prefix}_count`];
          const count = rawCount ? parseBalance(String(rawCount)) : 0;
          if (count <= 0) continue;
          guards.push({
            slot: slot.name,
            troopType: TROOP_TYPE[parseEnumValue(s[`${slot.prefix}_category`])] ?? "Unknown",
            troopTier: TROOP_TIER[parseEnumValue(s[`${slot.prefix}_tier`])] ?? "Unknown",
            count,
          });
        }
        result.set(entityId, {
          entityId,
          category: STRUCTURE_CATEGORY[Number(s.structure_category)] ?? "Unknown",
          level: Number(s.structure_level ?? 0),
          realmId: Number(s.realm_id ?? 0),
          ownerAddress: String(s.occupier_id ?? ""),
          position: { x: Number(s.coord_x), y: Number(s.coord_y) },
          guards,
          resources: [], // Not fetched in batch — use inspect_tile for full details
          explorerCount: Number(s.troop_explorer_count ?? 0),
          maxExplorerCount: Number(s.troop_max_explorer_count ?? 0),
        });
      }
    } catch (error) {
      this.logger.warn(`[ViewClient] structureInfoBatch query failed`, { error });
    }
    return result;
  }

  /** Parse raw guard array into clean GuardInfo[]. Only includes non-empty slots. */
  private parseGuards(guards: any[]): GuardInfo[] {
    const result: GuardInfo[] = [];
    for (const g of guards) {
      if (!g.troops || g.troops.count === 0n || g.troops.count === 0) continue;
      const count =
        typeof g.troops.count === "bigint" ? Number(g.troops.count) / RESOURCE_PRECISION : Number(g.troops.count);
      if (count <= 0) continue;
      result.push({
        slot: GUARD_SLOT_NAMES[g.slot] ?? `Slot ${g.slot}`,
        troopType: TROOP_TYPE[parseEnumValue(g.troops.category)] ?? "Unknown",
        troopTier: TROOP_TIER[parseEnumValue(g.troops.tier)] ?? "Unknown",
        count,
      });
    }
    return result;
  }

  /** Parse a ResourceBalanceRow into clean ResourceInfo[]. Only includes non-zero balances. */
  private parseResources(row: any): ResourceInfo[] {
    if (!row) return [];
    const result: ResourceInfo[] = [];
    for (const { column, name } of BALANCE_COLUMNS) {
      const amount = parseBalance(row[column]);
      if (amount > 0) {
        result.push({ name, amount: Math.floor(amount) });
      }
    }
    return result;
  }
}
