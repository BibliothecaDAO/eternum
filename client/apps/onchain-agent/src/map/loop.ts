/**
 * Background map refresh loop.
 *
 * Fetches all tiles from Torii every `intervalMs` (default 10s),
 * re-renders the ASCII map, updates MapContext.snapshot, and writes map.txt.
 */

import { writeFileSync } from "fs";
import type { EternumClient, ExplorerInfo } from "@bibliothecadao/client";
import type { StaminaConfig } from "@bibliothecadao/torii";
import { renderMap } from "./renderer.js";
import type { MapContext } from "./context.js";
import { isExplorer } from "../world/occupier.js";

interface MapLoop {
  start(): void;
  stop(): void;
  /** Force an immediate refresh (e.g. after a successful action). */
  refresh(): Promise<void>;
  readonly isRunning: boolean;
}

export function createMapLoop(
  client: EternumClient,
  ctx: MapContext,
  playerAddress?: string,
  intervalMs = 10_000,
  staminaConfig?: StaminaConfig,
): MapLoop {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let lastTileCount = -1;
  let lastOwnedCount = -1;

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

      // Fetch explorer details for owned armies so the map can show stamina/troops
      let explorerDetails: Map<number, ExplorerInfo> | undefined;
      if (ownedEntityIds && ownedEntityIds.size > 0) {
        explorerDetails = new Map();
        const ownedArmyTiles = area.tiles.filter(
          (t) => t.occupierId > 0 && ownedEntityIds!.has(t.occupierId) && isExplorer(t.occupierType),
        );
        const results = await Promise.allSettled(ownedArmyTiles.map((t) => client.view.explorerInfo(t.occupierId)));
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            explorerDetails.set(r.value.entityId, r.value);
          }
        }
      }

      // Pass previous anchor to keep row:col coordinates stable across renders
      const previousAnchor = ctx.snapshot?.anchor;
      const snapshot = renderMap(area.tiles, ownedEntityIds, explorerDetails, staminaConfig, previousAnchor);
      ctx.snapshot = snapshot;

      // Fresh Torii data supersedes optimistic position tracking.
      ctx.recentlyMoved = undefined;
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
