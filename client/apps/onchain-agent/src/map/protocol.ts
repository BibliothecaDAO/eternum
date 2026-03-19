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
import { calculateStrength, calculateGuardStrength } from "../world/strength.js";
import { projectExplorerStamina } from "../world/stamina.js";
import { BiomeIdToType } from "@bibliothecadao/types";
import { Coord, getNeighborOffsets } from "@bibliothecadao/types";

// ── Result types ──────────────────────────────────────────────────────

/** Deep drill-down on a single tile, returned by tileInfo(). */
export interface TileInfoResult {
  position: { x: number; y: number };
  biome: string;
  biomeId: number;
  explored: boolean;
  /** Full entity details if the tile is occupied. Null for empty/unexplored tiles. */
  entity: EntityInfoResult | null;
}

/** Summary of whatever occupies a tile. */
export interface OccupierSummary {
  kind: "structure" | "explorer" | "chest" | "quest" | "spire" | "empty";
  entityId: number;
  owned: boolean;
  /** One-line human-readable description. */
  label: string;
  /** Combat strength if applicable (explorer or guarded structure). */
  strength?: { base: number; display: string };
}

/** A nearby entity with distance, returned by nearby(). */
export interface NearbyEntity {
  position: { x: number; y: number };
  distance: number;
  occupier: OccupierSummary;
  biome: string;
}

/** Result of nearby() — grouped by category for immediate use. */
export interface NearbyResult {
  center: { x: number; y: number };
  radius: number;
  ownedArmies: NearbyEntity[];
  ownedStructures: NearbyEntity[];
  enemyArmies: NearbyEntity[];
  enemyStructures: NearbyEntity[];
  chests: NearbyEntity[];
  other: NearbyEntity[];
}

/** Full entity details, returned by entityInfo(). */
export interface EntityInfoResult {
  entityId: number;
  position: { x: number; y: number };
  kind: "structure" | "explorer" | "chest" | "quest" | "spire";
  owned: boolean;
  biome: string;
  biomeId: number;
  /** Explorer-specific fields. */
  explorer?: {
    troopType: string;
    troopTier: string;
    troopCount: number;
    stamina: number;
    strength: { base: number; display: string };
    owner: string;
  };
  /** Structure-specific fields. */
  structure?: {
    category: string;
    level: number;
    guards: GuardInfo[];
    guardStrength: { base: number; display: string };
    resources: ResourceInfo[];
    explorerCount: number;
    maxExplorerCount: number;
    owner: string;
  };
  /** Chest-specific fields. */
  chest?: {
    opened: boolean;
  };
}

/** A matching entity from find(). */
export interface FindResult {
  entityId: number;
  position: { x: number; y: number };
  kind: string;
  label: string;
  distance?: number;
  strength?: { base: number; display: string };
}

/** A diagnostic pushed automatically each refresh. */
export interface Diagnostic {
  severity: "threat" | "opportunity" | "info";
  message: string;
  position?: { x: number; y: number };
  entityId?: number;
}

// ── Target types for find() ───────────────────────────────────────────

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

function occupierKind(occupierType: number): OccupierSummary["kind"] {
  if (occupierType === 0) return "empty";
  if (isStructure(occupierType)) return "structure";
  if (isExplorer(occupierType)) return "explorer";
  if (isChest(occupierType)) return "chest";
  if (occupierType === 33) return "quest";
  if (occupierType === 35) return "spire";
  return "empty";
}

const STRUCTURE_TYPE_LABELS: Record<number, string> = {
  1: "Realm", 2: "Realm", 3: "Realm", 4: "Realm",
  5: "Wonder", 6: "Wonder", 7: "Wonder", 8: "Wonder",
  9: "Hyperstructure", 10: "Hyperstructure", 11: "Hyperstructure",
  12: "Fragment Mine", 13: "Village", 14: "Bank",
};

const EXPLORER_TYPE_LABELS: Record<number, string> = {
  15: "Knight", 16: "Knight", 17: "Knight",
  18: "Paladin", 19: "Paladin", 20: "Paladin",
  21: "Crossbowman", 22: "Crossbowman", 23: "Crossbowman",
  24: "Knight", 25: "Knight", 26: "Knight",
  27: "Paladin", 28: "Paladin", 29: "Paladin",
  30: "Crossbowman", 31: "Crossbowman", 32: "Crossbowman",
};

function biomeName(biomeId: number): string {
  const type = BiomeIdToType[biomeId];
  if (!type) return "Unknown";
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function hexDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return new Coord(a.x, a.y).distance(new Coord(b.x, b.y));
}

/** Decode a felt (hex address) to a human-readable short string, or truncate. */
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
 * Eternum Map Protocol — structured query layer over a MapSnapshot.
 *
 * Snapshot data is used when available (fast, sync). When an optional
 * EternumClient is provided, tileInfo and entityInfo do live fetches
 * to fill in details the snapshot doesn't have (guards, resources, troops).
 */
export class MapProtocol {
  /** Map center for coordinate conversion. 0 = no conversion (raw coords). */
  private mapCenter: number;

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


  /** Convert display X coordinate to raw contract coordinate. */
  toContractX(display: number): number {
    return this.mapCenter ? display + this.mapCenter : display;
  }

  /** Convert display Y coordinate to raw contract coordinate (negated back). */
  toContractY(display: number): number {
    return this.mapCenter ? -display + this.mapCenter : display;
  }

  /** Convert display coordinate to raw (kept for backward compat — X axis). */
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
   * Get structured info about a single tile by world coordinates.
   * When a client is available, fetches full entity details (guards, resources, troops).
   */
  async tileInfo(x: number, y: number): Promise<TileInfoResult> {
    const rawX = this.toContractX(x);
    const rawY = this.toContractY(y);
    const tile = this.snapshot.gridIndex.get(`${rawX},${rawY}`);

    if (!tile) {
      return { position: { x, y }, biome: "Unknown", biomeId: 0, explored: false, entity: null };
    }

    return {
      position: { x, y },
      biome: biomeName(tile.biome),
      biomeId: tile.biome,
      explored: true,
      entity: tile.occupierType !== 0 ? await this.resolveEntityDetails(tile) : null,
    };
  }

  // ── Position-based: "What's around here?" (like LSP findReferences) ─

  /**
   * Get all entities within a radius of a world position, grouped by category.
   * When a client is available, batch-fetches explorer details for army strength.
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
   * Get full details on an entity by ID. Returns null if the entity
   * is not on any explored tile. Fetches live data when a client is available.
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
   * Batch-enrich NearbyEntity army summaries with strength data.
   * Fetches explorer details for armies missing strength in their occupier summary.
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
   * Batch-enrich FindResult army entries with strength data.
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
   * Uses snapshot cache first, falls back to live ViewClient queries.
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
        const projected = this.staminaConfig
          ? projectExplorerStamina(detail, this.staminaConfig)
          : detail.stamina;
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
        base.structure = {
          category: detail.category,
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
   * Search the map for entities matching a type filter.
   * Optionally sorts by distance from a reference position.
   */
  async find(
    type: FindTargetType,
    referencePos?: { x: number; y: number },
    limit: number = 15,
  ): Promise<FindResult[]> {
    // Convert display ref to raw for distance calc
    const rawRef = referencePos ? { x: this.toContractX(referencePos.x), y: this.toContractY(referencePos.y) } : undefined;
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

      const label = kind === "structure"
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
   * Called by the map loop after each refresh. Results are injected into
   * the agent's context automatically (like LSP diagnostics).
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
          ? ` (~${calculateStrength(detail.troopCount, detail.troopTier, detail.troopType, neighbor.biome).display})`
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

      const stamina = this.staminaConfig
        ? projectExplorerStamina(detail, this.staminaConfig)
        : detail.stamina;

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
   * Build a compact structured briefing for the tick prompt.
   * Replaces the full ASCII map with ~2K chars of actionable data.
   */
  briefing(): string {
    const sections: string[] = [];

    // Your armies
    const armies: string[] = [];
    for (const tile of this.snapshot.tiles) {
      if (!isExplorer(tile.occupierType)) continue;
      if (!this.ownedEntityIds.has(tile.occupierId)) continue;

      const detail = this.snapshot.explorerDetails.get(tile.occupierId);
      if (detail) {
        const stamina = this.staminaConfig
          ? projectExplorerStamina(detail, this.staminaConfig)
          : detail.stamina;
        const strength = calculateStrength(detail.troopCount, detail.troopTier, detail.troopType, tile.biome);
        const biome = biomeName(tile.biome);
        const dp = this.displayPos(tile.position);
        armies.push(
          `  ${tile.occupierId} | ${detail.troopCount.toLocaleString()} ${detail.troopType} ${detail.troopTier} | str ${strength.display} | stam ${stamina} | at (${dp.x},${dp.y}) | ${biome}`,
        );
      } else {
        const dp = this.displayPos(tile.position);
        armies.push(`  ${tile.occupierId} | at (${dp.x},${dp.y})`);
      }
    }
    if (armies.length > 0) {
      sections.push(`YOUR ARMIES (${armies.length}):\n${armies.join("\n")}`);
    }

    // Your structures
    const structures: string[] = [];
    for (const tile of this.snapshot.tiles) {
      if (!isStructure(tile.occupierType)) continue;
      if (!this.ownedEntityIds.has(tile.occupierId)) continue;

      const detail = this.snapshot.structureDetails.get(tile.occupierId);
      if (detail) {
        const label = detail.category;
        const guards = detail.guards?.filter((g: GuardInfo) => g.count > 0) ?? [];
        const guardStr = guards.length > 0
          ? guards.map((g: GuardInfo) => `${g.count.toLocaleString()} ${g.troopType} ${g.troopTier}`).join(", ")
          : "unguarded";
        const dp = this.displayPos(tile.position);
        structures.push(
          `  ${tile.occupierId} | ${label} lv${detail.level} | armies ${detail.explorerCount}/${detail.maxExplorerCount} | guards: ${guardStr} | at (${dp.x},${dp.y})`,
        );
      } else {
        const label = STRUCTURE_TYPE_LABELS[tile.occupierType] ?? "Structure";
        const dp = this.displayPos(tile.position);
        structures.push(`  ${tile.occupierId} | ${label} | at (${dp.x},${dp.y})`);
      }
    }
    if (structures.length > 0) {
      sections.push(`YOUR STRUCTURES (${structures.length}):\n${structures.join("\n")}`);
    }

    // Diagnostics
    const diags = this.diagnostics();
    const threats = diags.filter((d) => d.severity === "threat");
    const opportunities = diags.filter((d) => d.severity === "opportunity");
    const info = diags.filter((d) => d.severity === "info");

    if (threats.length > 0) {
      sections.push(`THREATS (${threats.length}):\n${threats.map((d) => `  ⚠ ${d.message}`).join("\n")}`);
    }
    if (opportunities.length > 0) {
      sections.push(`OPPORTUNITIES (${opportunities.length}):\n${opportunities.map((d) => `  → ${d.message}`).join("\n")}`);
    }
    if (info.length > 0) {
      sections.push(`STATUS:\n${info.map((d) => `  ${d.message}`).join("\n")}`);
    }

    return sections.join("\n\n");
  }

  // ── Internal helpers ────────────────────────────────────────────

  private summarizeOccupier(tile: TileState): OccupierSummary | null {
    if (tile.occupierType === 0) return null;

    const kind = occupierKind(tile.occupierType);
    const owned = this.ownedEntityIds.has(tile.occupierId);
    let label: string;
    let strength: { base: number; display: string } | undefined;

    switch (kind) {
      case "structure": {
        label = STRUCTURE_TYPE_LABELS[tile.occupierType] ?? "Structure";
        if (owned) label = `Your ${label}`;
        const detail = this.snapshot.structureDetails.get(tile.occupierId);
        if (detail) {
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
 * Create a MapProtocol instance from the current snapshot.
 * Called by the map loop after each refresh.
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
