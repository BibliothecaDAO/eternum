/**
 * Eternum Map Protocol — structured query interface over the game world.
 *
 * Analogous to LSP for code: instead of dumping an ASCII map and forcing
 * the agent to visually parse a 2D grid, the protocol exposes typed
 * operations the agent queries on demand. Diagnostics (threats, opportunities)
 * are computed each refresh and pushed into the agent's context automatically.
 *
 * All data comes from {@link MapSnapshot}, which the background map loop
 * refreshes every 10s. The protocol is a query layer — no network calls.
 *
 * Operations mirror LSP's shape: position-based or entity-based queries
 * that return structured, actionable answers.
 *
 *   LSP                          Map Protocol
 *   ─────────────────────────    ─────────────────────────────
 *   hover(file, line, col)    →  tileInfo(x, y)
 *   findReferences(symbol)    →  nearby(x, y, radius)
 *   goToDefinition(symbol)    →  entityInfo(entityId)
 *   workspaceSymbol(query)    →  find(type, filter?)
 *   diagnostics (pushed)      →  diagnostics (pushed per refresh)
 */

import type { EternumClient } from "@bibliothecadao/client";
import type { TileState, GuardInfo, ResourceInfo } from "@bibliothecadao/client";
import type { StaminaConfig } from "@bibliothecadao/torii";
import type { MapSnapshot } from "./renderer.js";
import { isStructure, isExplorer, isChest } from "../world/occupier.js";
import { calculateStrength, calculateGuardStrength, biomeCombatModifiers, type Strength } from "../world/strength.js";
import { getRealmName } from "../data/realm-names.js";
import { projectExplorerStamina } from "../world/stamina.js";
import { BiomeIdToType } from "@bibliothecadao/types";
import { Coord, getNeighborOffsets } from "@bibliothecadao/types";

// ── Result types ──────────────────────────────────────────────────────

/**
 * Deep drill-down on a single tile, returned by {@link MapProtocol.tileInfo}.
 *
 * Contains biome info and, when the tile is occupied, full entity details.
 */
export interface TileInfoResult {
  /** Display coordinates (centered, Y-positive-north). */
  position: { x: number; y: number };
  /** Human-readable biome name (e.g. "Deep Ocean", "Tropical Seasonal Forest"). */
  biome: string;
  /** Raw numeric biome identifier from the contract. */
  biomeId: number;
  /** Whether this tile has been explored on the map. */
  explored: boolean;
  /** Combat modifier percentages for each troop type on this tile. */
  combat: { Knight: number; Crossbowman: number; Paladin: number };
  /** Full entity details if the tile is occupied. Null for empty/unexplored tiles. */
  entity: EntityInfoResult | null;
}

/**
 * Compact summary of whatever occupies a tile.
 *
 * Used inside {@link NearbyEntity} and by the internal `summarizeOccupier` helper.
 * Designed to be immediately scannable without needing a follow-up query.
 */
export interface OccupierSummary {
  /** Classification of the occupier. */
  kind: "structure" | "explorer" | "chest" | "quest" | "spire" | "empty";
  /** On-chain entity ID of the occupier. */
  entityId: number;
  /** Whether the current player owns this entity. */
  owned: boolean;
  /** One-line human-readable description (e.g. "Your 5,000 Knight T2", "Realm lv3"). */
  label: string;
  /** Combat strength if applicable (explorer or guarded structure). */
  strength?: Strength;
}

/**
 * A nearby entity with distance metadata, returned inside {@link NearbyResult}.
 */
export interface NearbyEntity {
  /** Display coordinates of the entity. */
  position: { x: number; y: number };
  /** Hex distance from the query center. */
  distance: number;
  /** Summary of the occupier at this position. */
  occupier: OccupierSummary;
  /** Human-readable biome name at this tile. */
  biome: string;
}

/**
 * Result of {@link MapProtocol.nearby} — entities grouped by category for immediate use.
 *
 * Each category is sorted by ascending hex distance from the query center.
 */
export interface NearbyResult {
  /** The display-coordinate center of the search. */
  center: { x: number; y: number };
  /** Search radius in hex tiles. */
  radius: number;
  /** Player-owned armies within range, sorted by distance. */
  ownedArmies: NearbyEntity[];
  /** Player-owned structures within range, sorted by distance. */
  ownedStructures: NearbyEntity[];
  /** Enemy armies within range, sorted by distance. */
  enemyArmies: NearbyEntity[];
  /** Enemy structures within range, sorted by distance. */
  enemyStructures: NearbyEntity[];
  /** Chests (opened or unopened) within range, sorted by distance. */
  chests: NearbyEntity[];
  /** Quests, spires, and other non-categorized entities within range. */
  other: NearbyEntity[];
}

/**
 * Full entity details for an on-chain entity, returned by {@link MapProtocol.entityInfo}
 * and {@link MapProtocol.tileInfo}.
 *
 * Exactly one of `explorer`, `structure`, or `chest` is populated based on `kind`.
 */
export interface EntityInfoResult {
  /** On-chain entity ID. */
  entityId: number;
  /** Display coordinates. */
  position: { x: number; y: number };
  /** Classification of the entity. */
  kind: "structure" | "explorer" | "chest" | "quest" | "spire";
  /** Whether the current player owns this entity. */
  owned: boolean;
  /** Human-readable biome name at the entity's tile. */
  biome: string;
  /** Raw numeric biome identifier. */
  biomeId: number;
  /** Explorer-specific fields. Present only when `kind === "explorer"`. */
  explorer?: {
    /** Troop class name (e.g. "Knight", "Paladin", "Crossbowman"). */
    troopType: string;
    /** Troop tier label (e.g. "T1", "T2", "T3"). */
    troopTier: string;
    /** Number of individual troops in the army. */
    troopCount: number;
    /** Current projected stamina (accounts for regeneration since last update). */
    stamina: number;
    /** Combat strength with base value and biome-modified display string. */
    strength: Strength;
    /** Owner display name ("You" for own armies, decoded felt or truncated address). */
    owner: string;
  };
  /** Structure-specific fields. Present only when `kind === "structure"`. */
  structure?: {
    /** Structure category (e.g. "Realm", "Hyperstructure", "Fragment Mine"). */
    category: string;
    /** Realm ID (for name lookup). 0 for non-realm structures. */
    realmId: number;
    /** Realm name (e.g. "Stolsli"). Empty for non-realm structures. */
    realmName: string;
    /** Current structure level. */
    level: number;
    /** Active guard slots with non-zero troop counts. */
    guards: GuardInfo[];
    /** Aggregate combat strength of all guards, accounting for biome. */
    guardStrength: Strength;
    /** Resources held by the structure. */
    resources: ResourceInfo[];
    /** Current number of explorers spawned from this structure. */
    explorerCount: number;
    /** Maximum explorers this structure can spawn. */
    maxExplorerCount: number;
    /** Owner display name ("You" for own structures, decoded felt or truncated address). */
    owner: string;
  };
  /** Chest-specific fields. Present only when `kind === "chest"`. */
  chest?: {
    /** Whether the chest reward has already been claimed. */
    opened: boolean;
  };
}

/**
 * A matching entity from {@link MapProtocol.find}, with optional distance
 * and strength when available.
 */
export interface FindResult {
  /** On-chain entity ID. */
  entityId: number;
  /** Display coordinates. */
  position: { x: number; y: number };
  /** Human-readable entity type (e.g. "Realm", "Knight", "Chest"). */
  kind: string;
  /** Descriptive label, prefixed with "Your" for owned entities. */
  label: string;
  /** Hex distance from the reference position (present only if `referencePos` was provided). */
  distance?: number;
  /** Combat strength (present for armies and guarded structures). */
  strength?: Strength;
}

/**
 * A diagnostic alert pushed automatically each snapshot refresh.
 *
 * Diagnostics are injected into the agent's context before each tick
 * to surface threats, opportunities, and status updates without requiring
 * the agent to poll.
 */
export interface Diagnostic {
  /** Alert severity: "threat" for imminent danger, "opportunity" for actionable advantage, "info" for status. */
  severity: "threat" | "opportunity" | "info";
  /** Human-readable description of the diagnostic. */
  message: string;
  /** Display coordinates of the relevant tile, when spatial. */
  position?: { x: number; y: number };
  /** Entity ID most relevant to this diagnostic (e.g. the threatening army or the target structure). */
  entityId?: number;
}

// ── Target types for find() ───────────────────────────────────────────

/**
 * Entity category filter for {@link MapProtocol.find}.
 *
 * - `"hyperstructure"` — victory-point structures (occupier types 9-11)
 * - `"mine"` — fragment mines (occupier type 12)
 * - `"village"` — villages (occupier type 13)
 * - `"chest"` — unopened chests only
 * - `"enemy_army"` / `"enemy_structure"` — entities not owned by the player
 * - `"own_army"` / `"own_structure"` — entities owned by the player
 */
export type FindTargetType =
  | "hyperstructure"
  | "mine"
  | "village"
  | "chest"
  | "enemy_army"
  | "enemy_structure"
  | "own_army"
  | "own_structure";

// ── Occupier type → kind mapping ──────────────────────────────────────

/**
 * Map a raw occupier type number to its semantic kind.
 * @param occupierType - Raw numeric occupier type from the tile state.
 * @returns The semantic kind string, or "empty" for unrecognized types.
 */
function occupierKind(occupierType: number): OccupierSummary["kind"] {
  if (occupierType === 0) return "empty";
  if (isStructure(occupierType)) return "structure";
  if (isExplorer(occupierType)) return "explorer";
  if (isChest(occupierType)) return "chest";
  if (occupierType === 33) return "quest";
  if (occupierType === 35) return "spire";
  return "empty";
}

/** Lookup table: occupier type number to structure category label. */
const STRUCTURE_TYPE_LABELS: Record<number, string> = {
  1: "Realm",
  2: "Realm",
  3: "Realm",
  4: "Realm",
  5: "Wonder",
  6: "Wonder",
  7: "Wonder",
  8: "Wonder",
  9: "Hyperstructure",
  10: "Hyperstructure",
  11: "Hyperstructure",
  12: "Fragment Mine",
  13: "Village",
  14: "Bank",
};

/** Lookup table: occupier type number to explorer troop class label. */
const EXPLORER_TYPE_LABELS: Record<number, string> = {
  15: "Knight",
  16: "Knight",
  17: "Knight",
  18: "Paladin",
  19: "Paladin",
  20: "Paladin",
  21: "Crossbowman",
  22: "Crossbowman",
  23: "Crossbowman",
  24: "Knight",
  25: "Knight",
  26: "Knight",
  27: "Paladin",
  28: "Paladin",
  29: "Paladin",
  30: "Crossbowman",
  31: "Crossbowman",
  32: "Crossbowman",
};

/**
 * Convert a raw biome ID to a human-readable name with space-separated words.
 * @param biomeId - Numeric biome identifier.
 * @returns Formatted biome name (e.g. "Tropical Seasonal Forest"), or "Unknown".
 */
function biomeName(biomeId: number): string {
  const type = BiomeIdToType[biomeId];
  if (!type) return "Unknown";
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * Compute hex distance between two positions using the Coord utility.
 * @param a - First position in raw contract coordinates.
 * @param b - Second position in raw contract coordinates.
 * @returns Integer hex distance.
 */
function hexDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return new Coord(a.x, a.y).distance(new Coord(b.x, b.y));
}

/**
 * Decode a felt-encoded address to a human-readable owner name.
 *
 * Attempts ASCII decoding first (Cartridge controller names are stored as felts).
 * Falls back to a truncated hex representation.
 *
 * @param address - Hex-encoded felt address string, or null/undefined.
 * @returns Decoded name, "The Vanguard" for address 0, or truncated hex.
 */
function decodeOwner(address: string | null | undefined): string {
  if (!address) return "Unknown";
  try {
    const n = BigInt(address);
    if (n === 0n) return "The Vanguard";
    // Try felt→ASCII decode (Cartridge controller names are stored as felts)
    if (n > 0n && n < 2n ** 248n) {
      const bytes: number[] = [];
      let val = n;
      while (val > 0n) {
        bytes.unshift(Number(val & 0xffn));
        val >>= 8n;
      }
      const decoded = String.fromCharCode(...bytes);
      if (/^[\x20-\x7e]+$/.test(decoded)) return decoded;
    }
  } catch {}
  return address.slice(0, 10) + "...";
}

// ── Protocol implementation ───────────────────────────────────────────

/**
 * Eternum Map Protocol — structured query layer over a {@link MapSnapshot}.
 *
 * Provides four LSP-style operations:
 * - {@link tileInfo} — deep drill-down on a single tile (like LSP hover)
 * - {@link nearby} — entities within a radius, grouped by category (like findReferences)
 * - {@link entityInfo} — full details on an entity by ID (like goToDefinition)
 * - {@link find} — search all tiles for entities matching a type filter (like workspaceSymbol)
 *
 * Plus automatic {@link diagnostics} computed each refresh (threats, opportunities, status).
 *
 * Snapshot data is used when available (fast, sync). When an optional
 * {@link EternumClient} is provided, `tileInfo` and `entityInfo` do live fetches
 * to fill in details the snapshot doesn't have (guards, resources, troops).
 *
 * @example
 * ```ts
 * const protocol = createMapProtocol(snapshot, ownedIds, staminaConfig, client, 2147483647);
 * const tile = await protocol.tileInfo(6, 4);
 * const enemies = await protocol.find("enemy_army", { x: 0, y: 0 }, 10);
 * const alerts = protocol.diagnostics();
 * ```
 */
export class MapProtocol {
  /** Map center for coordinate conversion. 0 = no conversion (raw coords). */
  private mapCenter: number;

  /**
   * @param snapshot - Current map snapshot containing tile and entity data.
   * @param ownedEntityIds - Set of entity IDs owned by the current player.
   * @param staminaConfig - Stamina regeneration config for projecting current stamina values.
   * @param client - Optional live client for fetching details not cached in the snapshot.
   * @param mapCenter - Contract coordinate of the map center; used to convert between
   *                     raw contract coords and display coords. 0 disables conversion.
   */
  constructor(
    private snapshot: MapSnapshot,
    private ownedEntityIds: Set<number>,
    private staminaConfig?: StaminaConfig,
    private client?: EternumClient,
    mapCenter: number = 0,
  ) {
    this.mapCenter = mapCenter;
  }

  /** Convert raw contract X coordinate to display coordinate. */
  private toDisplayX(raw: number): number {
    return this.mapCenter ? raw - this.mapCenter : raw;
  }

  /** Convert raw contract Y coordinate to display coordinate (negated so positive = north). */
  private toDisplayY(raw: number): number {
    return this.mapCenter ? -(raw - this.mapCenter) : raw;
  }

  /**
   * Convert a display X coordinate back to raw contract coordinate.
   * @param display - X in display space (centered on map center).
   * @returns X in raw contract space.
   */
  toContractX(display: number): number {
    return this.mapCenter ? display + this.mapCenter : display;
  }

  /**
   * Convert a display Y coordinate back to raw contract coordinate (negated back).
   * @param display - Y in display space (positive = north).
   * @returns Y in raw contract space.
   */
  toContractY(display: number): number {
    return this.mapCenter ? -display + this.mapCenter : display;
  }

  /**
   * Convert a display coordinate to raw contract coordinate (X axis only).
   *
   * @deprecated Use {@link toContractX} for clarity. Kept for backward compatibility.
   * @param display - X in display space.
   * @returns X in raw contract space.
   */
  toContract(display: number): number {
    return this.toContractX(display);
  }

  /** Convert a raw position to display position. */
  private displayPos(raw: { x: number; y: number }): { x: number; y: number } {
    return { x: this.toDisplayX(raw.x), y: this.toDisplayY(raw.y) };
  }

  /** Format a raw position as a display string like "(6,4)". */
  private fmtPos(raw: { x: number; y: number }): string {
    const dp = this.displayPos(raw);
    return `(${dp.x},${dp.y})`;
  }

  /** Format raw x,y as a display string. */
  private fmtXY(x: number, y: number): string {
    return `(${this.toDisplayX(x)},${this.toDisplayY(y)})`;
  }

  // ── Position-based: "What's at this tile?" (like LSP hover) ───────

  /**
   * Get structured info about a single tile by display coordinates.
   *
   * When a client is available, fetches full entity details (guards, resources, troops)
   * for occupied tiles. For unexplored or empty tiles, returns minimal biome data.
   *
   * @param x - Display X coordinate.
   * @param y - Display Y coordinate.
   * @returns Tile info with biome data and optional entity details.
   *
   * @example
   * ```ts
   * const tile = await protocol.tileInfo(6, 4);
   * if (tile.entity?.explorer) {
   *   console.log(`Army strength: ${tile.entity.explorer.strength.effective}`);
   * }
   * ```
   */
  async tileInfo(x: number, y: number): Promise<TileInfoResult> {
    const rawX = this.toContractX(x);
    const rawY = this.toContractY(y);
    const tile = this.snapshot.gridIndex.get(`${rawX},${rawY}`);

    if (!tile) {
      return { position: { x, y }, biome: "Unknown", biomeId: 0, explored: false, combat: { Knight: 0, Crossbowman: 0, Paladin: 0 }, entity: null };
    }

    return {
      position: { x, y },
      biome: biomeName(tile.biome),
      biomeId: tile.biome,
      explored: true,
      combat: biomeCombatModifiers(tile.biome),
      entity: tile.occupierType !== 0 ? await this.resolveEntityDetails(tile) : null,
    };
  }

  // ── Position-based: "What's around here?" (like LSP findReferences) ─

  /**
   * Get all entities within a hex radius of a display position, grouped by category.
   *
   * Categories: owned armies, owned structures, enemy armies, enemy structures, chests, other.
   * Each category is sorted by ascending distance. When a client is available,
   * batch-fetches explorer details to populate army strength values.
   *
   * @param x - Display X coordinate of the search center.
   * @param y - Display Y coordinate of the search center.
   * @param radius - Search radius in hex tiles.
   * @returns Entities grouped by category with distance metadata.
   *
   * @example
   * ```ts
   * const scan = await protocol.nearby(0, 0, 8);
   * for (const enemy of scan.enemyArmies) {
   *   console.log(`${enemy.occupier.label} at distance ${enemy.distance}`);
   * }
   * ```
   */
  async nearby(x: number, y: number, radius: number = 5): Promise<NearbyResult> {
    const rawCenter = { x: this.toContractX(x), y: this.toContractY(y) };
    const result: NearbyResult = {
      center: { x, y },
      radius,
      ownedArmies: [],
      ownedStructures: [],
      enemyArmies: [],
      enemyStructures: [],
      chests: [],
      other: [],
    };

    for (const tile of this.snapshot.tiles) {
      if (tile.occupierType === 0) continue;
      const dist = hexDistance(rawCenter, tile.position);
      if (dist > radius) continue;

      const occupier = this.summarizeOccupier(tile);
      if (!occupier || occupier.kind === "empty") continue;

      const entry: NearbyEntity = {
        position: this.displayPos(tile.position),
        distance: dist,
        occupier,
        biome: biomeName(tile.biome),
      };

      if (occupier.owned && occupier.kind === "explorer") result.ownedArmies.push(entry);
      else if (occupier.owned && occupier.kind === "structure") result.ownedStructures.push(entry);
      else if (!occupier.owned && occupier.kind === "explorer") result.enemyArmies.push(entry);
      else if (!occupier.owned && occupier.kind === "structure") result.enemyStructures.push(entry);
      else if (occupier.kind === "chest") result.chests.push(entry);
      else result.other.push(entry);
    }

    // Batch-enrich army summaries with strength from live data
    const allArmies = [...result.ownedArmies, ...result.enemyArmies];
    await this.enrichArmySummaries(allArmies);

    // Sort each category by distance
    const byDist = (a: NearbyEntity, b: NearbyEntity) => a.distance - b.distance;
    result.ownedArmies.sort(byDist);
    result.ownedStructures.sort(byDist);
    result.enemyArmies.sort(byDist);
    result.enemyStructures.sort(byDist);
    result.chests.sort(byDist);
    result.other.sort(byDist);

    return result;
  }

  // ── Entity-based: "Tell me about this entity" (like LSP goToDefinition) ─

  /**
   * Get full details on an entity by its on-chain ID.
   *
   * Searches the snapshot for the tile containing the entity, then resolves
   * full details (troops, guards, resources) using snapshot cache or live fetch.
   *
   * @param entityId - On-chain entity ID to look up.
   * @returns Full entity details, or null if the entity is not on any explored tile.
   *
   * @example
   * ```ts
   * const info = await protocol.entityInfo(42);
   * if (info?.structure) {
   *   console.log(`Guards: ${info.structure.guardStrength.effective}`);
   * }
   * ```
   */
  async entityInfo(entityId: number): Promise<EntityInfoResult | null> {
    // Find the tile this entity occupies
    let tile: TileState | null = null;
    for (const t of this.snapshot.tiles) {
      if (t.occupierId === entityId) {
        tile = t;
        break;
      }
    }
    if (!tile) return null;

    return this.resolveEntityDetails(tile);
  }

  /**
   * Batch-enrich NearbyEntity army summaries with strength data from live client.
   *
   * Only fetches for armies missing strength in their occupier summary.
   * No-op if no client is available or all armies already have strength.
   */
  private async enrichArmySummaries(armies: NearbyEntity[]): Promise<void> {
    const missing = armies.filter((a) => a.occupier.kind === "explorer" && !a.occupier.strength);
    if (missing.length === 0 || !this.client) return;

    const ids = missing.map((a) => a.occupier.entityId);
    const details = await this.client.view.explorerInfoBatch(ids);

    for (const entry of missing) {
      const detail = details.get(entry.occupier.entityId);
      if (!detail) continue;
      const tile = this.snapshot.gridIndex.get(`${entry.position.x},${entry.position.y}`);
      const biome = tile?.biome ?? 0;
      entry.occupier.strength = calculateStrength(detail.troopCount, detail.troopTier, detail.troopType, biome);
      entry.occupier.label = `${detail.troopCount.toLocaleString()} ${detail.troopType} ${detail.troopTier}`;
    }
  }

  /**
   * Batch-enrich FindResult army entries with strength data from live client.
   *
   * Only fetches for results missing strength. No-op if no client is available.
   */
  private async enrichFindResults(results: FindResult[]): Promise<void> {
    const missing = results.filter((r) => !r.strength);
    if (missing.length === 0 || !this.client) return;

    const ids = missing.map((r) => r.entityId);
    const details = await this.client.view.explorerInfoBatch(ids);

    for (const entry of missing) {
      const detail = details.get(entry.entityId);
      if (!detail) continue;
      const tile = this.snapshot.gridIndex.get(`${entry.position.x},${entry.position.y}`);
      const biome = tile?.biome ?? 0;
      entry.strength = calculateStrength(detail.troopCount, detail.troopTier, detail.troopType, biome);
      entry.label = `${detail.troopCount.toLocaleString()} ${detail.troopType} ${detail.troopTier}`;
    }
  }

  /**
   * Resolve full entity details for a tile occupier.
   *
   * Uses snapshot cache first, falls back to live ViewClient queries when a
   * client is available. Handles explorers, structures, and chests.
   *
   * @param tile - The tile state containing the occupier to resolve.
   * @returns Fully populated entity info with type-specific fields.
   */
  private async resolveEntityDetails(tile: TileState): Promise<EntityInfoResult> {
    const entityId = tile.occupierId;
    const owned = this.ownedEntityIds.has(entityId);
    const biome = tile.biome;
    const kind = occupierKind(tile.occupierType);
    const base: EntityInfoResult = {
      entityId,
      position: this.displayPos(tile.position),
      kind: kind as EntityInfoResult["kind"],
      owned,
      biome: biomeName(biome),
      biomeId: biome,
    };

    if (isExplorer(tile.occupierType)) {
      // Try snapshot cache first, then live fetch
      let detail = this.snapshot.explorerDetails.get(entityId);
      if (!detail && this.client) {
        detail = (await this.client.view.explorerInfo(entityId)) ?? undefined;
      }
      if (detail) {
        const projected = this.staminaConfig ? projectExplorerStamina(detail, this.staminaConfig) : detail.stamina;
        const strength = calculateStrength(detail.troopCount, detail.troopTier, detail.troopType, biome);
        base.explorer = {
          troopType: detail.troopType,
          troopTier: detail.troopTier,
          troopCount: detail.troopCount,
          stamina: projected,
          strength,
          owner: owned ? "You" : decodeOwner(detail.ownerAddress ?? detail.ownerName),
        };
      }
    } else if (isStructure(tile.occupierType)) {
      // Live fetch preferred (has resources); fall back to snapshot cache
      let detail: any = undefined;
      if (this.client) {
        detail = (await this.client.view.structureAt(tile.position.x, tile.position.y)) ?? undefined;
      }
      if (!detail) {
        detail = this.snapshot.structureDetails.get(entityId);
      }
      if (detail) {
        const guards = detail.guards?.filter((g: GuardInfo) => g.count > 0) ?? [];
        const guardStrength = calculateGuardStrength(guards, biome);
        const realmId = detail.realmId ?? 0;
        base.structure = {
          category: detail.category,
          realmId,
          realmName: getRealmName(realmId),
          level: detail.level,
          guards,
          guardStrength,
          resources: detail.resources ?? [],
          explorerCount: detail.explorerCount,
          maxExplorerCount: detail.maxExplorerCount,
          owner: owned ? "You" : decodeOwner(detail.ownerAddress),
        };
      }
    } else if (isChest(tile.occupierType)) {
      base.chest = { opened: tile.rewardExtracted };
    }

    return base;
  }

  // ── Global: "Find all X" (like LSP workspaceSymbol) ─────────────

  /**
   * Search the entire map for entities matching a type filter.
   *
   * When `referencePos` is provided, results are sorted by ascending hex distance.
   * For army searches (`"enemy_army"`, `"own_army"`), results are batch-enriched
   * with live strength data when a client is available.
   *
   * @param type - Entity category to search for.
   * @param referencePos - Optional display-coordinate position to sort results by distance from.
   * @param limit - Maximum number of results to return.
   * @returns Matching entities with optional distance and strength metadata.
   *
   * @example
   * ```ts
   * // Find the 5 nearest enemy armies to your position
   * const enemies = await protocol.find("enemy_army", { x: 0, y: 0 }, 5);
   * for (const e of enemies) {
   *   console.log(`${e.label} at (${e.position.x},${e.position.y}), strength: ${e.strength?.effective}`);
   * }
   * ```
   */
  async find(type: FindTargetType, referencePos?: { x: number; y: number }, limit: number = 15): Promise<FindResult[]> {
    // Convert display ref to raw for distance calc
    const rawRef = referencePos
      ? { x: this.toContractX(referencePos.x), y: this.toContractY(referencePos.y) }
      : undefined;
    const results: FindResult[] = [];

    for (const tile of this.snapshot.tiles) {
      if (tile.occupierType === 0) continue;

      const owned = this.ownedEntityIds.has(tile.occupierId);
      const kind = occupierKind(tile.occupierType);
      let match = false;

      switch (type) {
        case "hyperstructure":
          match = tile.occupierType >= 9 && tile.occupierType <= 11;
          break;
        case "mine":
          match = tile.occupierType === 12;
          break;
        case "village":
          match = tile.occupierType === 13;
          break;
        case "chest":
          match = isChest(tile.occupierType) && !tile.rewardExtracted;
          break;
        case "enemy_army":
          match = isExplorer(tile.occupierType) && !owned;
          break;
        case "enemy_structure":
          match = isStructure(tile.occupierType) && !owned;
          break;
        case "own_army":
          match = isExplorer(tile.occupierType) && owned;
          break;
        case "own_structure":
          match = isStructure(tile.occupierType) && owned;
          break;
      }

      if (!match) continue;

      const label =
        kind === "structure"
          ? (STRUCTURE_TYPE_LABELS[tile.occupierType] ?? "Structure")
          : kind === "explorer"
            ? (EXPLORER_TYPE_LABELS[tile.occupierType] ?? "Explorer")
            : kind === "chest"
              ? "Chest"
              : kind;

      const entry: FindResult = {
        entityId: tile.occupierId,
        position: this.displayPos(tile.position),
        kind: label,
        label: owned ? `Your ${label}` : label,
      };

      if (rawRef) {
        entry.distance = hexDistance(rawRef, tile.position);
      }

      // Attach strength for armies and guarded structures
      if (isExplorer(tile.occupierType)) {
        const detail = this.snapshot.explorerDetails.get(tile.occupierId);
        if (detail) {
          entry.strength = calculateStrength(detail.troopCount, detail.troopTier, detail.troopType, tile.biome);
        }
      } else if (isStructure(tile.occupierType)) {
        const detail = this.snapshot.structureDetails.get(tile.occupierId);
        if (detail) {
          const guards = detail.guards?.filter((g: GuardInfo) => g.count > 0) ?? [];
          if (guards.length > 0) {
            entry.strength = calculateGuardStrength(guards, tile.biome);
          }
        }
      }

      results.push(entry);
    }

    // Sort by distance if reference provided, otherwise by entity ID
    if (referencePos) {
      results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    const sliced = results.slice(0, limit);

    // Batch-enrich army results with strength from live data
    if (type === "enemy_army" || type === "own_army") {
      await this.enrichFindResults(sliced);
    }

    return sliced;
  }

  // ── Diagnostics: computed each refresh, pushed to agent ──────────

  /**
   * Compute diagnostics — threats, opportunities, and status alerts.
   *
   * Called by the map loop after each snapshot refresh. Results are injected
   * into the agent's context automatically (like LSP diagnostics).
   *
   * Detects:
   * - **Threats**: enemy armies adjacent to owned structures
   * - **Opportunities**: unopened chests near owned armies, enemy structures within 3 hexes
   * - **Info**: owned armies with high stamina (>= 80) ready to move
   *
   * @returns Array of diagnostics sorted by severity (threats first).
   */
  diagnostics(): Diagnostic[] {
    const diags: Diagnostic[] = [];

    // Threat: enemy explorers adjacent to owned structures
    for (const tile of this.snapshot.tiles) {
      if (!isStructure(tile.occupierType)) continue;
      if (!this.ownedEntityIds.has(tile.occupierId)) continue;

      const offsets = getNeighborOffsets(tile.position.y);
      for (const { i, j } of offsets) {
        const nx = tile.position.x + i;
        const ny = tile.position.y + j;
        const neighbor = this.snapshot.gridIndex.get(`${nx},${ny}`);
        if (!neighbor) continue;
        if (!isExplorer(neighbor.occupierType)) continue;
        if (this.ownedEntityIds.has(neighbor.occupierId)) continue;

        const detail = this.snapshot.explorerDetails.get(neighbor.occupierId);
        const strengthStr = detail
          ? (() => {
              const s = calculateStrength(detail.troopCount, detail.troopTier, detail.troopType, neighbor.biome);
              return ` (~${s.effective.toLocaleString()} strength)`;
            })()
          : "";

        diags.push({
          severity: "threat",
          message: `Enemy army at ${this.fmtXY(nx, ny)}${strengthStr} adjacent to your structure at ${this.fmtPos(tile.position)}`,
          position: this.displayPos({ x: nx, y: ny }),
          entityId: neighbor.occupierId,
        });
      }
    }

    // Opportunity: unopened chests near owned armies
    for (const tile of this.snapshot.tiles) {
      if (!isExplorer(tile.occupierType)) continue;
      if (!this.ownedEntityIds.has(tile.occupierId)) continue;

      const offsets = getNeighborOffsets(tile.position.y);
      for (const { i, j } of offsets) {
        const nx = tile.position.x + i;
        const ny = tile.position.y + j;
        const neighbor = this.snapshot.gridIndex.get(`${nx},${ny}`);
        if (!neighbor) continue;
        if (!isChest(neighbor.occupierType)) continue;
        if (neighbor.rewardExtracted) continue;

        diags.push({
          severity: "opportunity",
          message: `Unopened chest at ${this.fmtXY(nx, ny)} adjacent to your army at ${this.fmtPos(tile.position)}`,
          position: this.displayPos({ x: nx, y: ny }),
          entityId: tile.occupierId,
        });
      }
    }

    // Opportunity: unguarded enemy structures near owned armies (within 3 hexes)
    // Note: this is sync — guard data comes from snapshot cache only.
    // Enemy structures aren't fetched in the batch, so we track candidates
    // and the caller should verify with a live fetch before acting.
    for (const tile of this.snapshot.tiles) {
      if (!isExplorer(tile.occupierType)) continue;
      if (!this.ownedEntityIds.has(tile.occupierId)) continue;

      for (const candidate of this.snapshot.tiles) {
        if (!isStructure(candidate.occupierType)) continue;
        if (this.ownedEntityIds.has(candidate.occupierId)) continue;
        const dist = hexDistance(tile.position, candidate.position);
        if (dist > 3) continue;

        // Check snapshot cache first
        let detail = this.snapshot.structureDetails.get(candidate.occupierId);
        // For enemy structures, snapshot cache is usually empty — do NOT assume unguarded.
        // Only flag as unguarded if we have confirmed guard data showing 0 guards.
        if (!detail) {
          // No data — report as nearby enemy structure (unknown guard status)
          const label = STRUCTURE_TYPE_LABELS[candidate.occupierType] ?? "Structure";
          diags.push({
            severity: "opportunity",
            message: `${label} at ${this.fmtPos(candidate.position)}, ${dist} hexes from your army at ${this.fmtPos(tile.position)} — guard status unknown, use map_entity_info to check`,
            position: this.displayPos(candidate.position),
            entityId: candidate.occupierId,
          });
          continue;
        }

        const guards = detail.guards?.filter((g: GuardInfo) => g.count > 0) ?? [];
        if (guards.length === 0) {
          const label = STRUCTURE_TYPE_LABELS[candidate.occupierType] ?? "Structure";
          diags.push({
            severity: "opportunity",
            message: `Unguarded ${label} at ${this.fmtPos(candidate.position)}, ${dist} hexes from your army at ${this.fmtPos(tile.position)}`,
            position: this.displayPos(candidate.position),
            entityId: candidate.occupierId,
          });
        }
      }
    }

    // Info: armies with stamina ready to move
    for (const tile of this.snapshot.tiles) {
      if (!isExplorer(tile.occupierType)) continue;
      if (!this.ownedEntityIds.has(tile.occupierId)) continue;

      const detail = this.snapshot.explorerDetails.get(tile.occupierId);
      if (!detail) continue;

      const stamina = this.staminaConfig ? projectExplorerStamina(detail, this.staminaConfig) : detail.stamina;

      if (stamina >= 80) {
        diags.push({
          severity: "info",
          message: `Army ${tile.occupierId} at ${this.fmtPos(tile.position)} has ${stamina} stamina — ready to move`,
          position: this.displayPos(tile.position),
          entityId: tile.occupierId,
        });
      }
    }

    return diags;
  }

  // ── Briefing: compact tick context ──────────────────────────────

  /**
   * Build a compact structured briefing for the agent's tick prompt.
   *
   * Produces a ~2K character summary with sections:
   * Returns a structured summary object with counts, threat/opportunity
   * highlights, and army readiness. Use `map find` and `map entity-info`
   * for full details.
   *
   * @returns Structured briefing object.
   */
  briefing(): object {
    // Count armies and structures
    let armyCount = 0;
    let readyArmies = 0;
    let totalTroops = 0;
    const structureSummaries: Array<{ entityId: number; name: string; level: number; armies: string; position: { x: number; y: number } }> = [];

    for (const tile of this.snapshot.tiles) {
      if (isExplorer(tile.occupierType) && this.ownedEntityIds.has(tile.occupierId)) {
        armyCount++;
        const detail = this.snapshot.explorerDetails.get(tile.occupierId);
        if (detail) {
          totalTroops += detail.troopCount;
          const stamina = this.staminaConfig ? projectExplorerStamina(detail, this.staminaConfig) : detail.stamina;
          if (stamina >= 20) readyArmies++;
        }
      }

      if (isStructure(tile.occupierType) && this.ownedEntityIds.has(tile.occupierId)) {
        const detail = this.snapshot.structureDetails.get(tile.occupierId);
        const realmName = getRealmName(detail?.realmId ?? 0);
        const name = realmName || detail?.category || "Structure";
        structureSummaries.push({
          entityId: tile.occupierId,
          name,
          level: detail?.level ?? 0,
          armies: `${detail?.explorerCount ?? 0}/${detail?.maxExplorerCount ?? 0}`,
          position: this.displayPos(tile.position),
        });
      }
    }

    // Diagnostics
    const diags = this.diagnostics();
    const threats = diags.filter((d) => d.severity === "threat").map((d) => d.message);
    const opportunities = diags.filter((d) => d.severity === "opportunity").map((d) => d.message);

    return {
      armies: { count: armyCount, ready: readyArmies, totalTroops },
      structures: structureSummaries,
      threats,
      opportunities,
    };
  }

  // ── Internal helpers ────────────────────────────────────────────

  /**
   * Build a compact {@link OccupierSummary} for a tile occupier.
   *
   * Uses snapshot-cached details when available to populate strength and
   * descriptive labels. Returns null only for truly empty tiles.
   *
   * @param tile - Tile state to summarize.
   * @returns Occupier summary, or null if the tile is empty.
   */
  private summarizeOccupier(tile: TileState): OccupierSummary | null {
    if (tile.occupierType === 0) return null;

    const kind = occupierKind(tile.occupierType);
    const owned = this.ownedEntityIds.has(tile.occupierId);
    let label: string;
    let strength: Strength | undefined;

    switch (kind) {
      case "structure": {
        label = STRUCTURE_TYPE_LABELS[tile.occupierType] ?? "Structure";
        if (owned) label = `Your ${label}`;
        const detail = this.snapshot.structureDetails.get(tile.occupierId);
        if (detail) {
          const realmName = getRealmName(detail.realmId ?? 0);
          if (realmName) label += ` "${realmName}"`;
          const guards = detail.guards?.filter((g: GuardInfo) => g.count > 0) ?? [];
          if (guards.length > 0) {
            strength = calculateGuardStrength(guards, tile.biome);
          }
          label += ` lv${detail.level}`;
        }
        break;
      }
      case "explorer": {
        const typeName = EXPLORER_TYPE_LABELS[tile.occupierType] ?? "Explorer";
        label = owned ? `Your ${typeName}` : typeName;
        const detail = this.snapshot.explorerDetails.get(tile.occupierId);
        if (detail) {
          strength = calculateStrength(detail.troopCount, detail.troopTier, detail.troopType, tile.biome);
          label = owned
            ? `Your ${detail.troopCount.toLocaleString()} ${detail.troopType} ${detail.troopTier}`
            : `${detail.troopCount.toLocaleString()} ${detail.troopType} ${detail.troopTier}`;
        }
        break;
      }
      case "chest":
        label = tile.rewardExtracted ? "Opened chest" : "Chest";
        break;
      case "quest":
        label = "Quest";
        break;
      case "spire":
        label = "Spire";
        break;
      default:
        label = `Unknown (type ${tile.occupierType})`;
    }

    return { kind, entityId: tile.occupierId, owned, label, strength };
  }
}

/**
 * Create a {@link MapProtocol} instance from the current snapshot.
 *
 * Convenience factory called by the map loop after each refresh.
 *
 * @param snapshot - Current map snapshot with tile and entity data.
 * @param ownedEntityIds - Set of entity IDs owned by the current player.
 * @param staminaConfig - Optional stamina regeneration config for projecting stamina.
 * @param client - Optional live client for fetching details missing from the snapshot.
 * @param mapCenter - Contract coordinate of the map center (0 disables coordinate conversion).
 * @returns Configured MapProtocol instance ready for queries.
 */
export function createMapProtocol(
  snapshot: MapSnapshot,
  ownedEntityIds: Set<number>,
  staminaConfig?: StaminaConfig,
  client?: EternumClient,
  mapCenter: number = 0,
): MapProtocol {
  return new MapProtocol(snapshot, ownedEntityIds, staminaConfig, client, mapCenter);
}
