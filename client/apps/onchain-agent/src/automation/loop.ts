import { writeFileSync } from "fs";
import { join } from "path";
import type { EternumClient } from "@bibliothecadao/client";
import type { EternumProvider } from "@bibliothecadao/provider";
import type { GameConfig } from "@bibliothecadao/torii";
import type { MapContext } from "../map/context.js";
import { parseRealmSnapshot } from "./snapshot.js";
import { resolvePlan } from "./runner.js";
import { buildOrderForBiome, troopPathForBiome } from "./build-order.js";
import { planProduction, type BuildingTarget } from "./production.js";
import { findOpenSlots } from "./placement.js";
import { executeRealmTick, type BuildAction, type UpgradeAction, type ProductionActions } from "./executor.js";
import { formatStatus, type RealmStatus } from "./status.js";
import type { RealmState } from "./runner.js";

interface AutomationLoop {
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
  readonly isRunning: boolean;
}

/**
 * Compute the scaled building cost for a given building type.
 *
 * Formula (matches game client getBuildingCosts):
 *   totalCost = baseCost + (quantity - 1)² × baseCost × (percentIncrease / 10000)
 *
 * Returns an array of { resource, amount } with scaled amounts, or empty if
 * no cost data is available for this building type.
 */
function scaledBuildingCost(
  buildingType: number,
  existingQuantity: number,
  gameConfig: GameConfig,
  useSimple: boolean,
): { resource: number; amount: number }[] {
  const config = gameConfig.buildingCosts[buildingType];
  if (!config) return [];

  const costs = useSimple ? config.simpleCosts : config.complexCosts;
  if (costs.length === 0) return [];

  const percentIncrease = gameConfig.buildingBaseCostPercentIncrease / 10000;
  const scaleFactor = Math.max(0, existingQuantity - 1);

  return costs.map((cost) => ({
    resource: cost.resource,
    amount: cost.amount + scaleFactor * scaleFactor * cost.amount * percentIncrease,
  }));
}

export function createAutomationLoop(
  client: EternumClient,
  provider: EternumProvider,
  signer: any,
  playerAddress: string,
  dataDir: string,
  mapCtx: MapContext,
  gameConfig: GameConfig,
  intervalMs = 60_000,
): AutomationLoop {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let tickCount = 0;

  async function tick() {
    tickCount++;
    try {
      // Phase 1: Discover owned realms
      const sql = client.sql as any;
      if (typeof sql.fetchStructuresByOwner !== "function") return;

      const allStructures: { entity_id: number; coord_x: number; coord_y: number; category: number; level: number }[] =
        typeof sql.fetchPlayerStructures === "function"
          ? await sql.fetchPlayerStructures(playerAddress)
          : await sql.fetchStructuresByOwner(playerAddress);

      // Only process Realms (1) and Villages (5)
      const realmEntities = allStructures.filter(
        (s) => Number(s.entity_id) > 0 && (s.category === 1 || s.category === 5),
      );
      if (realmEntities.length === 0) return;

      // Build coordinate → biome lookup from map snapshot
      const gridIndex = mapCtx.snapshot?.gridIndex;

      // Phase 2: Fetch state in parallel
      const snapshotRows = await Promise.all(
        realmEntities.map(async (s) => {
          const entityId = Number(s.entity_id);
          const biome = gridIndex?.get(`${s.coord_x},${s.coord_y}`)?.biome ?? 11;
          const level = s.level || 1;
          try {
            const rows = typeof sql.fetchResourceBalancesWithProduction === "function"
              ? await sql.fetchResourceBalancesWithProduction([entityId])
              : await sql.fetchResourceBalancesAndProduction([entityId]);
            return { entityId, biome, level, row: rows?.[0] ?? null };
          } catch {
            return { entityId, biome, level, row: null };
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
      // Filter out center hex (10,10) and castle/center building (category 25)
      // — these are the realm structure itself, not player-built buildings.
      const buildingsByRealm = new Map<number, Set<string>>();
      const buildingCountsByRealm = new Map<number, Map<number, number>>();
      for (const b of buildingRows) {
        // Skip the center hex — it's the realm structure, not a building slot
        if (b.inner_col === 10 && b.inner_row === 10) continue;
        // Skip castle/center building type and empty/destroyed slots (None = 0)
        if (b.category === 0 || b.category === 25) continue;

        const key = b.outer_entity_id;
        if (!buildingsByRealm.has(key)) buildingsByRealm.set(key, new Set());
        buildingsByRealm.get(key)!.add(`${b.inner_col},${b.inner_row}`);

        if (!buildingCountsByRealm.has(key)) buildingCountsByRealm.set(key, new Map());
        const counts = buildingCountsByRealm.get(key)!;
        counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
      }

      // Phase 3 & 4: Plan and execute in parallel
      const realmStatuses: RealmStatus[] = [];

      const results = await Promise.allSettled(
        snapshotRows.map(async ({ entityId, biome, level, row }) => {
          // Pass timestamp so snapshot computes projectedBalances (for prioritisation).
          // Budget/spending uses snapshot.balances (raw on-chain values) to avoid
          // "Insufficient Balance" tx failures from overestimation.
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const snapshot = parseRealmSnapshot(row, currentTimestamp);
          const realmName = `Realm ${entityId}`;

          // Merge building counts: the SQL building query has ALL buildings
          // (including non-resource ones like WorkersHut), while snapshot only
          // has resource-producing buildings. Use the SQL data as the source of truth.
          const buildingCounts = buildingCountsByRealm.get(entityId) ?? snapshot.buildingCounts;

          const realmState: RealmState = {
            biome,
            level,
            buildingCounts,
          };

          // Plan: building — collect ALL builds that fit this tick
          const buildOrder = buildOrderForBiome(biome);
          const plan = resolvePlan(buildOrder, realmState, gameConfig.buildingCosts);

          // DEBUG: log what automation sees
          const countsObj: Record<string, number> = {};
          for (const [k, v] of buildingCounts) countsObj[`type_${k}`] = v;
          console.log(`[AUTO] Realm ${entityId} | biome=${biome} level=${level} | buildings:`, countsObj);
          console.log(
            `[AUTO] Realm ${entityId} | plan: ${plan.builds.length} builds, upgrade=${!!plan.upgrade}, idle=${plan.idle}`,
          );
          if (plan.builds.length > 0) {
            console.log(
              `[AUTO] Realm ${entityId} | planned:`,
              plan.builds.map((b) => b.step.label),
            );
          }

          // Don't upgrade in the same tick as builds — the provider batches
          // everything into one multicall, and a failed upgrade kills all builds.
          // Only upgrade when all slots are full (plan.upgrade set by runner)
          // AND we can afford the on-chain costs.
          let upgradeIntent: UpgradeAction | null = null;
          if (plan.upgrade && plan.builds.length === 0) {
            const targetLevel = plan.upgrade.fromLevel + 1;
            const upgradeCosts = gameConfig.realmUpgradeCosts[targetLevel];
            const canAffordUpgrade = upgradeCosts?.length > 0 && upgradeCosts.every((c: { resource: number; amount: number }) => (snapshot.balances.get(c.resource) ?? 0) >= c.amount);
            if (canAffordUpgrade) {
              upgradeIntent = plan.upgrade;
            } else {
              console.log(`[AUTO] Realm ${entityId} | skipping upgrade to level ${targetLevel} — can't afford costs`);
            }
          }

          // Find open slots for all planned builds
          const occupied = buildingsByRealm.get(entityId) ?? new Set();
          console.log(`[AUTO] Realm ${entityId} | occupied positions: ${occupied.size}`, [...occupied]);
          const { slots } = findOpenSlots(occupied, level, plan.builds.length);
          console.log(`[AUTO] Realm ${entityId} | open slots found: ${slots.length}`);

          // Compute building targets with costs (planner handles affordability)
          const runningCounts = new Map(buildingCounts);
          const candidateBuilds: BuildingTarget[] = [];

          let slotIdx = 0;
          for (let bi = 0; bi < plan.builds.length && slotIdx < slots.length; bi++) {
            const build = plan.builds[bi];
            const { step } = build;
            const slot = slots[slotIdx];
            const existingQuantity = runningCounts.get(step.building) ?? 0;

            const complexCosts = scaledBuildingCost(step.building, existingQuantity, gameConfig, false);
            const simpleCosts = scaledBuildingCost(step.building, existingQuantity, gameConfig, true);

            let costs: { resource: number; amount: number }[];
            let useSimple: boolean;
            if (complexCosts.length > 0) {
              costs = complexCosts;
              useSimple = false;
            } else if (simpleCosts.length > 0) {
              costs = simpleCosts;
              useSimple = true;
            } else {
              continue;
            }

            candidateBuilds.push({
              buildingType: step.building,
              label: step.label,
              costs,
              useSimple,
              slot,
            });

            runningCounts.set(step.building, existingQuantity + 1);
            slotIdx++;
          }

          // Unified plan: buildings + production compete for the same budget
          const troopPath = troopPathForBiome(biome);
          const isVillage = realmEntities.find((r) => Number(r.entity_id) === entityId)?.category === 5;
          const unifiedPlan = planProduction(
            snapshot.balances, buildingCounts, troopPath, gameConfig, 60, isVillage, candidateBuilds,
          );

          // Convert affordable builds to BuildActions for executor
          const buildActions: BuildAction[] = unifiedPlan.affordableBuilds.map((bt) => ({
            step: { building: bt.buildingType, label: bt.label },
            slot: bt.slot,
            useSimple: bt.useSimple,
          }));

          console.log(`[AUTO] Realm ${entityId} | candidates: ${candidateBuilds.length}, affordable: ${buildActions.length}`);
          if (buildActions.length > 0) {
            console.log(`[AUTO] Realm ${entityId} | building:`, buildActions.map((a) => a.step.label));
          }
          if (unifiedPlan.skippedBuilds.length > 0) {
            console.log(`[AUTO] Realm ${entityId} | skipped builds:`, unifiedPlan.skippedBuilds.map((s) => s.label));
          }

          // Run both complex and simple production every tick
          let productionCalls: ProductionActions | null = null;
          if (unifiedPlan.calls.length > 0) {
            const resourceToResource = unifiedPlan.calls
              .filter((c) => c.method === "complex")
              .map((c) => ({ resource_id: c.resourceId, cycles: c.cycles }));
            const laborToResource = unifiedPlan.calls
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
            buildActions,
            upgradeIntent,
            productionCalls,
          });

          // Build order progress — use the last build's index or total if idle
          const lastBuildIndex =
            plan.builds.length > 0 ? plan.builds[plan.builds.length - 1].index : buildOrder.steps.length;
          const progress = `${lastBuildIndex}/${buildOrder.steps.length}`;

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
