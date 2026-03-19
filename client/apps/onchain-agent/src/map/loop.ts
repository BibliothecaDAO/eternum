/**
 * Background map refresh loop.
 *
 * Fetches all tiles from Torii every `intervalMs` (default 10 s),
 * re-renders the ASCII map, updates `MapContext.snapshot`, and writes the
 * result to `ctx.filePath` (typically `<dataDir>/map.txt`). Skips disk
 * writes when `filePath` is null (e.g. in tests).
 */

import { writeFileSync } from "fs";
import type { EternumClient, ExplorerInfo, StructureInfo } from "@bibliothecadao/client";
import type { StaminaConfig } from "@bibliothecadao/torii";
import { renderMap } from "./renderer.js";
import type { MapContext } from "./context.js";
import { createMapProtocol } from "./protocol.js";
import { isExplorer } from "../world/occupier.js";
import { detectThreats, type ThreatAlert } from "./threat-detection.js";

/**
 * Handle returned by {@link createMapLoop} to control the background refresh cycle.
 */
interface MapLoop {
  /** Begin periodic refreshes. No-op if already running. */
  start(): void;
  /** Stop the periodic timer and mark the loop as inactive. */
  stop(): void;
  /** Force an immediate refresh (e.g. after a successful action). */
  refresh(): Promise<void>;
  /** Whether the periodic refresh timer is currently active. */
  readonly isRunning: boolean;
}

/**
 * Create a background map refresh loop.
 *
 * Each tick fetches all explored tiles from Torii, resolves owned entity IDs
 * (structures and explorers) for the given player, fetches explorer and
 * structure details, renders the ASCII map via {@link renderMap}, updates
 * `ctx.snapshot`, and writes the result to `ctx.filePath` when set. Pending
 * context entries (`recentlyMoved`, `recentlyExplored`, `recentlyOpenedChests`)
 * are pruned when Torii confirms the expected state.
 *
 * @param client - Eternum client used to query tiles and entity details.
 * @param ctx - Shared mutable map context updated on every refresh.
 * @param playerAddress - Hex address of the controlling player. When set, enables ownership
 *                        highlighting, explorer details (stamina, troops), and structure
 *                        details (level, guard slots). Omit to disable all entity annotations.
 * @param intervalMs - Refresh interval in milliseconds. Defaults to 10 000 ms.
 * @param staminaConfig - Stamina config used to project current stamina values.
 * @param onThreat - Callback invoked when enemy explorers are detected adjacent to owned
 *                   structures. Receives deduplicated alerts (same enemy position is not
 *                   re-reported for 60 seconds).
 * @param mapCenter - Entity ID used to center the rendered map. Defaults to 0 (world origin).
 * @returns A {@link MapLoop} handle with `start`, `stop`, `refresh`, and `isRunning`.
 */
export function createMapLoop(
  client: EternumClient,
  ctx: MapContext,
  playerAddress?: string,
  intervalMs = 10_000,
  staminaConfig?: StaminaConfig,
  onThreat?: (alerts: ThreatAlert[]) => void,
  mapCenter: number = 0,
): MapLoop {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let lastTileCount = -1;
  let lastOwnedCount = -1;
  const recentThreatAlerts = new Set<string>();

  async function update() {
    try {
      const area = await client.view.mapArea({ x: 0, y: 0, radius: 999_999 });

      // Fetch entity IDs owned by the agent so the map highlights them
      let ownedEntityIds: Set<number> | undefined;
      if (playerAddress) {
        try {
          const sql = client.sql as any;
          if (typeof sql.fetchStructuresByOwner === "function") {
            const structures: { entity_id: number }[] = await sql.fetchStructuresByOwner(playerAddress);
            ownedEntityIds = new Set(structures.map((s) => Number(s.entity_id)));

            // Also fetch explorer (army) entity IDs owned by the player's structures
            if (ownedEntityIds.size > 0 && typeof sql.fetchExplorersByStructures === "function") {
              try {
                const explorers: { explorer_id: number }[] = await sql.fetchExplorersByStructures([...ownedEntityIds]);
                for (const e of explorers) {
                  ownedEntityIds.add(Number(e.explorer_id));
                }
              } catch {
                // Non-critical — armies just won't be highlighted
              }
            }
          }
        } catch {
          // Non-critical — render without ownership highlights
        }
      }

      const tileCount = area.tiles.length;
      const ownedCount = ownedEntityIds?.size ?? 0;
      if (tileCount !== lastTileCount || ownedCount !== lastOwnedCount) {
        console.log(`[MAP] tiles=${tileCount}, ownedIds=${ownedCount}`);
        lastTileCount = tileCount;
        lastOwnedCount = ownedCount;
      }

      // Fetch explorer details in a single batch SQL query (instead of N individual requests)
      let explorerDetails: Map<number, ExplorerInfo> | undefined;
      if (ownedEntityIds && ownedEntityIds.size > 0) {
        const ownedArmyTiles = area.tiles.filter(
          (t) => t.occupierId > 0 && ownedEntityIds!.has(t.occupierId) && isExplorer(t.occupierType),
        );
        const armyIds = ownedArmyTiles.map((t) => t.occupierId);
        if (armyIds.length > 0 && typeof client.view.explorerInfoBatch === "function") {
          explorerDetails = await client.view.explorerInfoBatch(armyIds);
        } else if (armyIds.length > 0) {
          // Fallback: individual requests with concurrency limit
          explorerDetails = new Map();
          for (let i = 0; i < armyIds.length; i += 5) {
            const batch = armyIds.slice(i, i + 5);
            const results = await Promise.allSettled(batch.map((id) => client.view.explorerInfo(id)));
            for (const r of results) {
              if (r.status === "fulfilled" && r.value) explorerDetails.set(r.value.entityId, r.value);
            }
          }
        }
      }

      // Fetch structure details in a single batch SQL query
      let structureDetailMap: Map<number, StructureInfo> | undefined;
      if (ownedEntityIds && ownedEntityIds.size > 0) {
        const ownedStructureTiles = area.tiles.filter(
          (t) => t.occupierId > 0 && ownedEntityIds!.has(t.occupierId) && t.occupierIsStructure,
        );
        const structureIds = ownedStructureTiles.map((t) => t.occupierId);
        if (structureIds.length > 0 && typeof client.view.structureInfoBatch === "function") {
          structureDetailMap = await client.view.structureInfoBatch(structureIds);
        } else if (structureIds.length > 0) {
          // Fallback: individual requests with concurrency limit
          structureDetailMap = new Map();
          for (let i = 0; i < ownedStructureTiles.length; i += 5) {
            const batch = ownedStructureTiles.slice(i, i + 5);
            const results = await Promise.allSettled(
              batch.map((t) => client.view.structureAt(t.position.x, t.position.y)),
            );
            for (const r of results) {
              if (r.status === "fulfilled" && r.value) structureDetailMap.set(r.value.entityId, r.value);
            }
          }
        }
      }

      // Pass previous anchor to keep row:col coordinates stable across renders
      const previousAnchor = ctx.snapshot?.anchor;
      const snapshot = renderMap(
        area.tiles,
        ownedEntityIds,
        explorerDetails,
        staminaConfig,
        previousAnchor,
        structureDetailMap,
      );
      ctx.snapshot = snapshot;
      ctx.protocol = createMapProtocol(snapshot, ownedEntityIds ?? new Set(), staminaConfig, client, mapCenter);

      if (onThreat && ownedEntityIds) {
        const toInput = (t: any) => ({
          x: t.position.x,
          y: t.position.y,
          occupierId: t.occupierId,
          occupierType: t.occupierType,
          isOwned: ownedEntityIds!.has(t.occupierId),
        });
        const ownedStructureTiles = snapshot.tiles
          .filter((t) => t.occupierId > 0 && ownedEntityIds.has(t.occupierId) && t.occupierIsStructure)
          .map(toInput);
        const allTileInputs = snapshot.tiles.filter((t) => t.occupierId > 0).map(toInput);
        const alerts = detectThreats(ownedStructureTiles, allTileInputs, recentThreatAlerts);
        if (alerts.length > 0) {
          for (const a of alerts) {
            recentThreatAlerts.add(`${a.enemyX},${a.enemyY}`);
            setTimeout(() => recentThreatAlerts.delete(`${a.enemyX},${a.enemyY}`), 60_000);
          }
          onThreat(alerts);
        }
      }

      // Prune recentlyMoved — remove entries where Torii now shows the army
      // at the expected position. Keep entries where Torii hasn't caught up.
      if (ctx.recentlyMoved && ctx.recentlyMoved.size > 0) {
        for (const [tileKey, entityId] of ctx.recentlyMoved) {
          const tile = snapshot.gridIndex.get(tileKey);
          if (tile && tile.occupierId === entityId) {
            ctx.recentlyMoved.delete(tileKey);
          }
        }
        if (ctx.recentlyMoved.size === 0) ctx.recentlyMoved = undefined;
      }
      // Prune recentlyExplored — remove tiles that now appear in the snapshot.
      if (ctx.recentlyExplored && ctx.recentlyExplored.size > 0) {
        for (const tileKey of ctx.recentlyExplored) {
          if (snapshot.gridIndex.has(tileKey)) {
            ctx.recentlyExplored.delete(tileKey);
          }
        }
        if (ctx.recentlyExplored.size === 0) ctx.recentlyExplored = undefined;
      }
      // Prune recentlyOpenedChests — remove when tile no longer has a chest.
      if (ctx.recentlyOpenedChests && ctx.recentlyOpenedChests.size > 0) {
        for (const tileKey of ctx.recentlyOpenedChests) {
          const tile = snapshot.gridIndex.get(tileKey);
          if (!tile || tile.occupierType !== 34) {
            ctx.recentlyOpenedChests.delete(tileKey);
          }
        }
        if (ctx.recentlyOpenedChests.size === 0) ctx.recentlyOpenedChests = undefined;
      }
      // Note: staminaSpent is NOT cleared on refresh — Torii may not have
      // indexed the stamina-consuming tx yet. It's cleared per-army in the
      // move tool when explorerInfo returns an updated staminaUpdatedTick.

      if (ctx.filePath) writeFileSync(ctx.filePath, snapshot.text);
    } catch (_) {
      // Silently skip failed refreshes — next cycle will retry
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      // Fire immediately, then on interval
      update();
      timer = setInterval(update, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      running = false;
    },
    async refresh() {
      await update();
    },
    get isRunning() {
      return running;
    },
  };
}
