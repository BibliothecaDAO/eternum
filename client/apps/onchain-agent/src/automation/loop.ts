import { writeFileSync } from "fs";
import { join } from "path";
import type { EternumClient } from "@bibliothecadao/client";
import type { EternumProvider } from "@bibliothecadao/provider";
import type { MapContext } from "../map/context.js";
import { parseRealmSnapshot } from "./snapshot.js";
import { resolveIntent } from "./runner.js";
import { buildOrderForBiome, troopPathForBiome } from "./build-order.js";
import { planProduction } from "./production.js";
import { findOpenSlot } from "./placement.js";
import { executeRealmTick, type BuildAction, type UpgradeAction, type ProductionActions } from "./executor.js";
import { formatStatus, type RealmStatus } from "./status.js";
import type { RealmState } from "./runner.js";

export interface AutomationLoop {
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
  readonly isRunning: boolean;
}

export function createAutomationLoop(
  client: EternumClient,
  provider: EternumProvider,
  signer: any,
  playerAddress: string,
  dataDir: string,
  mapCtx: MapContext,
  intervalMs = 60_000,
): AutomationLoop {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function tick() {
    try {
      // Phase 1: Discover owned realms
      const sql = client.sql as any;
      if (typeof sql.fetchStructuresByOwner !== "function") return;

      const structures: { entity_id: number; coord_x: number; coord_y: number }[] =
        await sql.fetchStructuresByOwner(playerAddress);

      const realmEntities = structures.filter((s) => Number(s.entity_id) > 0);
      if (realmEntities.length === 0) return;

      // Build coordinate → biome lookup from map snapshot
      const gridIndex = mapCtx.snapshot?.gridIndex;

      // Phase 2: Fetch state in parallel
      const snapshotRows = await Promise.all(
        realmEntities.map(async (s) => {
          const entityId = Number(s.entity_id);
          const biome = gridIndex?.get(`${s.coord_x},${s.coord_y}`)?.biome ?? 11;
          try {
            const rows = await sql.fetchResourceBalancesAndProduction([entityId]);
            return { entityId, biome, coordX: s.coord_x, coordY: s.coord_y, row: rows?.[0] ?? null };
          } catch {
            return { entityId, biome, coordX: s.coord_x, coordY: s.coord_y, row: null };
          }
        }),
      );

      // Fetch building positions for all realms
      const entityIds = realmEntities.map((s) => Number(s.entity_id));
      let buildingRows: { outer_entity_id: number; inner_col: number; inner_row: number; category: number }[] = [];
      try {
        if (typeof sql.fetchBuildingsByStructures === "function") {
          buildingRows = await sql.fetchBuildingsByStructures(entityIds);
        }
      } catch {
        // Continue without building data
      }

      // Group buildings by realm
      const buildingsByRealm = new Map<number, Set<string>>();
      for (const b of buildingRows) {
        const key = b.outer_entity_id;
        if (!buildingsByRealm.has(key)) buildingsByRealm.set(key, new Set());
        buildingsByRealm.get(key)!.add(`${b.inner_col},${b.inner_row}`);
      }

      // Phase 3 & 4: Plan and execute in parallel
      const realmStatuses: RealmStatus[] = [];

      const results = await Promise.allSettled(
        snapshotRows.map(async ({ entityId, biome, row }) => {
          const snapshot = parseRealmSnapshot(row);

          const level = 1; // TODO: resolve from structure level
          const realmName = `Realm ${entityId}`;

          const realmState: RealmState = {
            biome,
            level,
            buildingCounts: snapshot.buildingCounts,
          };

          // Plan: building
          const buildOrder = buildOrderForBiome(biome);
          const intent = resolveIntent(buildOrder, realmState);

          let buildIntent: BuildAction | null = null;
          let upgradeIntent: UpgradeAction | null = null;

          if (intent.action === "build") {
            const occupied = buildingsByRealm.get(entityId) ?? new Set();
            const slot = findOpenSlot(occupied, level);
            if (slot) {
              buildIntent = {
                action: "build",
                step: intent.step,
                index: intent.index,
                slot,
              };
            }
          } else if (intent.action === "upgrade") {
            upgradeIntent = {
              fromLevel: intent.fromLevel,
              fromName: intent.fromName,
              toName: intent.toName,
            };
          }

          // Plan: production
          const troopPath = troopPathForBiome(biome);
          const plan = planProduction(snapshot.balances, snapshot.activeBuildings, troopPath);

          let productionCalls: ProductionActions | null = null;
          if (plan.calls.length > 0) {
            const resourceToResource = plan.calls
              .filter((c) => c.method === "complex")
              .map((c) => ({ resource_id: c.resourceId, cycles: c.cycles }));
            const laborToResource = plan.calls
              .filter((c) => c.method === "simple")
              .map((c) => ({ resource_id: c.resourceId, cycles: c.cycles }));

            if (resourceToResource.length > 0 || laborToResource.length > 0) {
              productionCalls = { resourceToResource, laborToResource };
            }
          }

          // Execute
          const tickResult = await executeRealmTick({
            provider,
            signer,
            realmEntityId: entityId,
            buildIntent,
            upgradeIntent,
            productionCalls,
          });

          // Build order progress
          const progress =
            intent.action === "idle"
              ? `${buildOrder.steps.length}/${buildOrder.steps.length}`
              : `${(intent as any).index ?? 0}/${buildOrder.steps.length}`;

          return {
            realmEntityId: entityId,
            realmName,
            biome,
            level,
            buildOrderProgress: progress,
            tickResult,
            essencePulse: {
              balance: snapshot.balances.get(38) ?? 0,
              sufficient: true,
            },
            wheatPulse: {
              balance: snapshot.balances.get(35) ?? 0,
              low: (snapshot.balances.get(35) ?? 0) < 200,
              movesRemaining: Math.floor((snapshot.balances.get(35) ?? 0) / 20),
            },
          } as RealmStatus;
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          realmStatuses.push(r.value);
        }
      }

      // Phase 5: Write status file
      const statusText = formatStatus({
        timestamp: new Date(),
        realms: realmStatuses,
      });

      try {
        writeFileSync(join(dataDir, "automation-status.txt"), statusText);
      } catch {
        // Non-critical
      }
    } catch {
      // Silently skip failed ticks — next cycle will retry
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      tick();
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      running = false;
    },
    async refresh() {
      await tick();
    },
    get isRunning() {
      return running;
    },
  };
}
